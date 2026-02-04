import React, { useEffect, useState } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"
import { store } from "./store.ts"

/**
 * @framerDisableUnlink
 * @framerIntrinsicWidth 300
 * @framerIntrinsicHeight 300
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
export default function BroadcastEmptyState(props) {
    const [isEmpty, setIsEmpty] = useState(false)
    const isCanvas = RenderTarget.current() === RenderTarget.canvas

    useEffect(() => {
        if (isCanvas) return

        const unsubscribe = store.subscribe((state) => {
            setIsEmpty(state.filteredItems.length === 0)
        })
        return unsubscribe
    }, [isCanvas])

    const style = {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
    }

    // --- RENDU CANVAS (PREVIEW) ---
    if (isCanvas) {
        if (props.emptyStateInstance) {
            return <div style={style}>{props.emptyStateInstance}</div>
        }
        return (
            <div
                style={{
                    ...style,
                    border: "1px dashed #8855FF",
                    color: "#8855FF",
                    backgroundColor: "rgba(136, 85, 255, 0.1)",
                    padding: 20,
                    textAlign: "center",
                    borderRadius: 8,
                    fontSize: 14,
                }}
            >
                Connectez un composant "Empty State" via le panneau de droite
            </div>
        )
    }

    // --- RENDU LIVE ---
    if (!isEmpty) return null

    return <div style={style}>{props.emptyStateInstance}</div>
}

addPropertyControls(BroadcastEmptyState, {
    emptyStateInstance: {
        type: ControlType.ComponentInstance,
        title: "Composant Vide",
        description:
            "Ce composant s'affichera uniquement s'il n'y a aucun résultat.",
    },
})
