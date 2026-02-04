import { Override, RenderTarget } from "framer"
import { useEffect, useRef } from "react"
import { store, FilterState } from "./store.ts"

const CONTAINER_ATTR = "data-filter-container"

export function Broadcaster(): Override {
    const isCanvas = RenderTarget.current() === RenderTarget.canvas
    const unsubscribeRef = useRef<(() => void) | null>(null)
    const containerRef = useRef<HTMLElement | null>(null)
    const rafId = useRef<number | null>(null)
    const itemsCache = useRef<Map<HTMLElement, any>>(new Map())

    useEffect(() => {
        if (isCanvas) return

        const init = () => {
            const container = document.querySelector(
                `[${CONTAINER_ATTR}="true"]`
            ) as HTMLElement
            if (!container) {
                rafId.current = requestAnimationFrame(init)
                return
            }
            containerRef.current = container

            const cleanKey = (name: string) =>
                name.trim().toLowerCase().replace(/\s+/g, "_")

            /**
             * Scan optimisé : ne scanne que les éléments non encore en cache
             */
            const scanItems = () => {
                if (!containerRef.current) return

                const children = Array.from(
                    containerRef.current.children
                ).filter(
                    (c) => c.getAttribute("data-is-ghost") !== "true"
                ) as HTMLElement[]

                const itemsData = children.map((child, index) => {
                    // Si on a déjà les données en cache pour cet élément, on les réutilise
                    if (itemsCache.current.has(child)) {
                        const cached = itemsCache.current.get(child)
                        cached._index = index // On met quand même à jour l'index original
                        return cached
                    }

                    // Nouveau scan pour cet élément
                    const data: any = { _element: child, _index: index }
                    const namedLayers =
                        child.querySelectorAll("[data-framer-name]")

                    namedLayers.forEach((layer) => {
                        const rawName = layer.getAttribute("data-framer-name")
                        if (rawName) {
                            const key = cleanKey(rawName)
                            data[key] = layer.textContent || ""
                            // On stocke aussi dans un dataset pour lecture rapide ultérieure
                            child.dataset[key] = data[key]
                        }
                    })

                    itemsCache.current.set(child, data)
                    return data
                })

                store.setItems(itemsData)

                if (
                    store.state.pagination.isEnabled &&
                    store.state.pagination.totalItems === 0
                ) {
                    store.setPagination({ totalItems: itemsData.length })
                }
            }

            // --- CSS INJECTION ---
            const styleId = "broadcast-filter-styles"
            if (!document.getElementById(styleId)) {
                const style = document.createElement("style")
                style.id = styleId
                style.textContent = `
                    .broadcast-hidden {
                        display: none !important;
                    }
                    [data-filter-container="true"] {
                        display: grid !important;
                    }
                `
                document.head.appendChild(style)
            }

            /**
             * Mise à jour de l'UI ultra-rapide avec batching
             */
            const updateUI = (state: FilterState) => {
                if (rafId.current) cancelAnimationFrame(rafId.current)

                rafId.current = requestAnimationFrame(() => {
                    const { filteredItems, pagination, items } = state
                    if (!containerRef.current) return

                    let itemsToShow = filteredItems
                    if (pagination.isEnabled) {
                        const { currentPage, itemsPerPage, mode } = pagination
                        if (mode === "pagination") {
                            const start = (currentPage - 1) * itemsPerPage
                            itemsToShow = filteredItems.slice(
                                start,
                                start + itemsPerPage
                            )
                        } else if (
                            mode === "loadMore" ||
                            mode === "autoScroll"
                        ) {
                            itemsToShow = filteredItems.slice(
                                0,
                                currentPage * itemsPerPage
                            )
                        }
                    }

                    const itemsToShowSet = new Set(itemsToShow)

                    // 1. Visibilité : Un seul passage sur tous les éléments
                    // On utilise le cache d'éléments pour éviter de reparcourir le DOM
                    for (const item of items) {
                        const el = item._element
                        if (!el) continue

                        const shouldBeVisible = itemsToShowSet.has(item)
                        const isCurrentlyHidden =
                            el.classList.contains("broadcast-hidden")

                        if (shouldBeVisible && isCurrentlyHidden) {
                            el.classList.remove("broadcast-hidden")
                        } else if (!shouldBeVisible && !isCurrentlyHidden) {
                            el.classList.add("broadcast-hidden")
                        }
                    }

                    // 2. Ordre : Seulement sur les éléments filtrés
                    // On ne met à jour l'ordre que si nécessaire (évite reflows inutiles)
                    for (let i = 0; i < filteredItems.length; i++) {
                        const el = filteredItems[i]._element
                        if (el) {
                            const targetOrder = String(i)
                            if (el.style.order !== targetOrder) {
                                el.style.order = targetOrder
                            }
                        }
                    }

                    window.dispatchEvent(
                        new CustomEvent("broadcast-pagination-update", {
                            detail: { totalItems: filteredItems.length },
                        })
                    )
                })
            }

            // --- OBSERVATION DOM ---
            // On nettoie le cache des éléments supprimés
            let scanTimeout: any
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((m) => {
                    m.removedNodes.forEach((node) => {
                        if (node instanceof HTMLElement)
                            itemsCache.current.delete(node)
                    })
                })
                clearTimeout(scanTimeout)
                scanTimeout = setTimeout(scanItems, 150)
            })

            observer.observe(container, { childList: true })

            unsubscribeRef.current = store.subscribe(updateUI)
            setTimeout(scanItems, 100)
        }

        rafId.current = requestAnimationFrame(init)

        return () => {
            if (unsubscribeRef.current) unsubscribeRef.current()
            if (rafId.current) cancelAnimationFrame(rafId.current)
        }
    }, [])

    return {
        [CONTAINER_ATTR]: "true",
        animate: { opacity: 1 },
    }
}
