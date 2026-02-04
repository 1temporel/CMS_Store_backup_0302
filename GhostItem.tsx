import { Override, RenderTarget } from "framer"
import { useEffect, useId, useRef } from "react"
import { store } from "./store"

/**
 * GhostItem Override
 *
 * GHOST PATTERN: Cet override doit être appliqué sur chaque item
 * dans la liste CMS native de Framer.
 *
 * Il lit les props CMS du composant et les enregistre dans le store.
 * Le composant devient "fantôme" (display: none) car le rendu visuel
 * est délégué à DisplayGrid.tsx.
 *
 * USAGE:
 * 1. Appliquer cet override sur le composant card dans la CMS List
 * 2. Configurer les props CMS à capturer dans les variables Framer
 * 3. DisplayGrid.tsx se charge du rendu visuel
 */

interface GhostItemProps {
    // Props CMS - à mapper depuis les variables Framer
    id?: string
    title?: string
    price?: string
    category?: string
    image?: string
    description?: string
    date?: string
    // Ajoutez d'autres champs selon votre CMS
    [key: string]: any
}

/**
 * Override principal pour les items CMS.
 * Capture les données et les enregistre dans le store.
 */
export function GhostItem(props: GhostItemProps): Override {
    const isCanvas = RenderTarget.current() === RenderTarget.canvas
    const uniqueId = useId()
    const registeredRef = useRef(false)
    const propsRef = useRef<GhostItemProps>(props)

    // Mettre à jour la ref des props
    propsRef.current = props

    useEffect(() => {
        if (isCanvas) return

        // Générer un ID unique basé sur les props ou utiliser useId
        const itemId = props.id || props.slug || uniqueId

        // Extraire les données pertinentes (exclure les props internes React/Framer)
        const excludedKeys = new Set([
            "children",
            "style",
            "className",
            "__fromCodeComponentNode",
        ])

        const itemData: Record<string, any> = {
            _id: itemId,
            _index: props._index ?? 0,
        }

        // Capturer toutes les props non-exclues
        Object.entries(propsRef.current).forEach(([key, value]) => {
            if (!excludedKeys.has(key) && value !== undefined) {
                // Normaliser la clé (lowercase, underscores)
                const normalizedKey = key
                    .trim()
                    .toLowerCase()
                    .replace(/\s+/g, "_")
                itemData[normalizedKey] = value
            }
        })

        // Enregistrer dans le store
        store.registerGhostItem(itemData)
        registeredRef.current = true

        // Cleanup au unmount
        return () => {
            if (registeredRef.current) {
                store.unregisterGhostItem(itemId)
                registeredRef.current = false
            }
        }
    }, [isCanvas, props.id, props.slug, uniqueId])

    // Retourner un wrapper invisible (le fantôme)
    return {
        style: {
            display: "none",
            visibility: "hidden",
            position: "absolute",
            pointerEvents: "none",
        },
        "data-ghost-item": "true",
        "data-ghost-id": props.id || props.slug || uniqueId,
    }
}

/**
 * Override alternatif avec configuration explicite des champs.
 * Utilisez cette version si vous voulez contrôler précisément
 * quels champs CMS sont capturés.
 */
export function GhostItemConfigured(fieldMapping: Record<string, string>) {
    return function ConfiguredGhostItem(props: any): Override {
        const isCanvas = RenderTarget.current() === RenderTarget.canvas
        const uniqueId = useId()
        const registeredRef = useRef(false)

        useEffect(() => {
            if (isCanvas) return

            const itemId = props.id || props.slug || uniqueId

            // Mapper les champs selon la configuration
            const itemData: Record<string, any> = {
                _id: itemId,
                _index: props._index ?? 0,
            }

            Object.entries(fieldMapping).forEach(([storeKey, propKey]) => {
                const value = props[propKey]
                if (value !== undefined) {
                    itemData[storeKey.toLowerCase().replace(/\s+/g, "_")] =
                        value
                }
            })

            store.registerGhostItem(itemData)
            registeredRef.current = true

            return () => {
                if (registeredRef.current) {
                    store.unregisterGhostItem(itemId)
                    registeredRef.current = false
                }
            }
        }, [isCanvas, props.id, props.slug, uniqueId])

        return {
            style: {
                display: "none",
                visibility: "hidden",
                position: "absolute",
                pointerEvents: "none",
            },
            "data-ghost-item": "true",
        }
    }
}

/**
 * Override avec index automatique basé sur l'ordre DOM.
 * Utile quand les items n'ont pas d'index explicite.
 */
let globalIndexCounter = 0
const indexMap = new Map<string, number>()

export function GhostItemAutoIndex(props: GhostItemProps): Override {
    const isCanvas = RenderTarget.current() === RenderTarget.canvas
    const uniqueId = useId()
    const registeredRef = useRef(false)
    const assignedIndex = useRef<number | null>(null)

    useEffect(() => {
        if (isCanvas) return

        const itemId = props.id || props.slug || uniqueId

        // Assigner un index unique si pas déjà fait
        if (!indexMap.has(itemId)) {
            indexMap.set(itemId, globalIndexCounter++)
        }
        assignedIndex.current = indexMap.get(itemId)!

        const excludedKeys = new Set([
            "children",
            "style",
            "className",
            "__fromCodeComponentNode",
        ])

        const itemData: Record<string, any> = {
            _id: itemId,
            _index: assignedIndex.current,
        }

        Object.entries(props).forEach(([key, value]) => {
            if (!excludedKeys.has(key) && value !== undefined) {
                const normalizedKey = key
                    .trim()
                    .toLowerCase()
                    .replace(/\s+/g, "_")
                itemData[normalizedKey] = value
            }
        })

        store.registerGhostItem(itemData)
        registeredRef.current = true

        return () => {
            if (registeredRef.current) {
                store.unregisterGhostItem(itemId)
                registeredRef.current = false
            }
        }
    }, [isCanvas, props.id, props.slug, uniqueId])

    return {
        style: {
            display: "none",
            visibility: "hidden",
            position: "absolute",
            pointerEvents: "none",
        },
        "data-ghost-item": "true",
    }
}
