import React, { useEffect, useState } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"
import { store } from "./store.ts"

/**
 * @framerDisableUnlink
 * @framerIntrinsicWidth 250
 * @framerIntrinsicHeight 48
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
export default function BroadcastCounter(props) {
    const {
        prefix = "Items: ",
        suffix = "",
        showPrefix = true,
        showIfZero = true,
        fontColor = "#000000",
        background = "transparent",
        font,
    } = props

    const [itemCount, setItemCount] = useState(0)
    const isCanvas = RenderTarget.current() === RenderTarget.canvas

    // --- LOGIQUE ROBUSTE ---
    useEffect(() => {
        if (!isCanvas) {
            const unsubscribe = store.subscribe((state) => {
                setItemCount(state.pagination.totalItems)
            })
            return unsubscribe
        }
    }, [isCanvas])

    // --- STYLES DYNAMIQUES ---
    const align = font?.textAlign || "center"
    const justifyContent =
        align === "right"
            ? "flex-end"
            : align === "center"
              ? "center"
              : "flex-start"

    const containerStyle = {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: justifyContent,
        backgroundColor: background,
        whiteSpace: "nowrap", // Empêche le texte de se couper bizarrement
    }

    // --- RENDU CANVAS (PREVIEW) ---
    if (isCanvas) {
        return (
            <div style={containerStyle}>
                <div style={{ ...font, color: fontColor }}>
                    {showPrefix && prefix}42{suffix}
                </div>
            </div>
        )
    }

    // --- RENDU LIVE ---
    if (itemCount === 0 && !showIfZero) return null

    return (
        <div style={containerStyle}>
            <div style={{ ...font, color: fontColor }}>
                {showPrefix && prefix}
                {itemCount}
                {suffix}
            </div>
        </div>
    )
}

addPropertyControls(BroadcastCounter, {
    prefix: {
        type: ControlType.String,
        title: "Prefix",
        defaultValue: "Items: ",
        hidden: (props) => !props.showPrefix,
    },
    showPrefix: {
        type: ControlType.Boolean,
        title: "Show Prefix",
        defaultValue: true,
    },
    suffix: { type: ControlType.String, title: "Suffix", defaultValue: "" },
    showIfZero: {
        type: ControlType.Boolean,
        title: "Show If Zero",
        defaultValue: true,
    },
    fontColor: {
        type: ControlType.Color,
        title: "Font Color",
        defaultValue: "#000000",
    },
    background: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "transparent",
    },
    font: {
        type: ControlType.Font,
        controls: "extended",
        title: "Font",
        defaultValue: { fontSize: 16, textAlign: "center" },
    },
})
