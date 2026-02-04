import React, { useState, useEffect, useId, ComponentType } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"
import { store, FilterState, GhostItemData } from "./store"

/**
 * DisplayGrid - Code Component
 *
 * GHOST PATTERN: Ce composant remplace la partie "Rendu" du Broadcaster.
 * Il s'abonne au store et affiche les items filtrés avec pagination.
 *
 * USAGE:
 * 1. Ajouter ce composant sur votre page
 * 2. Connecter votre Card Component via la prop cardComponent
 * 3. Le composant gère automatiquement le filtrage et la pagination
 */

interface DisplayGridProps {
    cardComponent?: ComponentType<any>
    columns?: number
    gap?: number
    rowGap?: number
    style?: React.CSSProperties
}

/**
 * @framerDisableUnlink
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 600
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
export default function DisplayGrid(props: DisplayGridProps) {
    const {
        cardComponent: CardComponent,
        columns = 3,
        gap = 16,
        rowGap,
        style,
    } = props

    const isCanvas = RenderTarget.current() === RenderTarget.canvas
    const gridId = useId()

    const [visibleItems, setVisibleItems] = useState<GhostItemData[]>([])
    const [totalFiltered, setTotalFiltered] = useState(0)

    // S'abonner au store
    useEffect(() => {
        if (isCanvas) return

        const handleStoreUpdate = (state: FilterState) => {
            const { filteredItems, pagination } = state

            // Calculer les items visibles selon la pagination
            let itemsToShow = filteredItems

            if (pagination.isEnabled) {
                const { currentPage, itemsPerPage, mode } = pagination

                if (mode === "pagination") {
                    // Mode pagination classique: slice de la page courante
                    const start = (currentPage - 1) * itemsPerPage
                    const end = start + itemsPerPage
                    itemsToShow = filteredItems.slice(start, end)
                } else if (mode === "loadMore" || mode === "autoScroll") {
                    // Mode load more / auto scroll: accumulation
                    itemsToShow = filteredItems.slice(0, currentPage * itemsPerPage)
                }
            }

            setVisibleItems(itemsToShow)
            setTotalFiltered(filteredItems.length)
        }

        const unsubscribe = store.subscribe(handleStoreUpdate)
        return unsubscribe
    }, [isCanvas])

    // Rendu Canvas (preview)
    if (isCanvas) {
        return (
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${columns}, 1fr)`,
                    gap: gap,
                    rowGap: rowGap ?? gap,
                    width: "100%",
                    ...style,
                }}
            >
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                        key={i}
                        style={{
                            background: "#F0F0F0",
                            borderRadius: 8,
                            aspectRatio: "1",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#999",
                            fontSize: 14,
                        }}
                    >
                        Card {i}
                    </div>
                ))}
            </div>
        )
    }

    // Pas de CardComponent configuré
    if (!CardComponent) {
        return (
            <div
                style={{
                    padding: 20,
                    background: "#FFF3CD",
                    border: "1px solid #FFEEBA",
                    borderRadius: 8,
                    color: "#856404",
                    textAlign: "center",
                }}
            >
                Veuillez connecter un Card Component via les props.
            </div>
        )
    }

    // Pas d'items à afficher
    if (visibleItems.length === 0) {
        return null // Le composant EmptyState gère ce cas
    }

    return (
        <div
            id={gridId}
            style={{
                display: "grid",
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gap: gap,
                rowGap: rowGap ?? gap,
                width: "100%",
                ...style,
            }}
        >
            {visibleItems.map((item, index) => (
                <CardComponent
                    key={item._id || `item-${index}`}
                    {...item}
                    _gridIndex={index}
                />
            ))}
        </div>
    )
}

addPropertyControls(DisplayGrid, {
    cardComponent: {
        type: ControlType.ComponentInstance,
        title: "Card Component",
    },
    columns: {
        type: ControlType.Number,
        title: "Columns",
        defaultValue: 3,
        min: 1,
        max: 12,
        step: 1,
    },
    gap: {
        type: ControlType.Number,
        title: "Gap",
        defaultValue: 16,
        min: 0,
        max: 100,
        step: 1,
    },
    rowGap: {
        type: ControlType.Number,
        title: "Row Gap",
        defaultValue: 16,
        min: 0,
        max: 100,
        step: 1,
    },
})
