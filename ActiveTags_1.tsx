import React, { useState, useEffect } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

const RESET_EVENT = "reset-broadcast-filters"
const UPDATE_EVENT = "broadcast-items-updated"
const REFRESH_EVENT = "broadcast-force-refresh"
import { store } from "./store.ts"

/**
 * @framerDisableUnlink
 * @framerIntrinsicWidth 250
 * @framerIntrinsicHeight 48
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
export default function BroadcastActiveTags(props) {
    const [tags, setTags] = useState([])
    const isCanvas = RenderTarget.current() === RenderTarget.canvas

    // --- STORE INTEGRATION ---
    useEffect(() => {
        if (isCanvas) return

        const handleStoreUpdate = (state) => {
            const newTags = []

            state.activeFilters.forEach((value, key) => {
                // Determine layout name from key
                // Key format: filter_multi_city or filter_slider_price
                let type = "unknown"
                let layerName = ""

                if (key.startsWith("filter_multi_")) {
                    type = "multi"
                    layerName = key
                        .replace("filter_multi_", "")
                        .replace(/_/g, " ")
                } else if (key.startsWith("filter_slider_")) {
                    type = "slider"
                    layerName = key
                        .replace("filter_slider_", "")
                        .replace(/_/g, " ")
                }

                if (type === "slider") {
                    const [min, max] = value
                    newTags.push({
                        id: key,
                        key: key,
                        label: `${layerName}: ${min} - ${max}`,
                        type: "slider",
                        raw: value,
                    })
                } else if (type === "multi") {
                    if (Array.isArray(value)) {
                        value.forEach((option) => {
                            newTags.push({
                                id: `${key}-${option}`,
                                key: key,
                                label: option,
                                type: "multi",
                                valueToRemove: option,
                            })
                        })
                    }
                }
            })

            // Sort tags to prevent jumping
            newTags.sort((a, b) => a.id.localeCompare(b.id))
            setTags(newTags)
        }

        const unsubscribe = store.subscribe(handleStoreUpdate)
        return unsubscribe
    }, [isCanvas])

    const removeTag = (tag) => {
        if (tag.type === "slider") {
            store.removeFilter(tag.key)
        } else if (tag.type === "multi") {
            const current = store.state.activeFilters.get(tag.key)
            if (Array.isArray(current)) {
                const updated = current.filter(
                    (item) => item !== tag.valueToRemove
                )
                store.setFilter(tag.key, updated)
            }
        }
    }

    const clearAll = () => {
        store.resetFilters()
    }

    const tagStyle = {
        padding: props.padding,
        background: props.tagBackground,
        borderRadius: props.borderRadius,
        display: "flex",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
        border: `${props.border.borderWidth}px ${props.border.borderStyle} ${props.border.borderColor}`,
        ...props.font,
        color: props.tagColor,
        transition: "opacity 0.2s",
    }
    const clearStyle = {
        cursor: "pointer",
        textDecoration: "underline",
        color: props.clearColor,
        fontSize: 14,
        marginLeft: 4,
        whiteSpace: "nowrap" as const,
        ...props.font,
    }
    const iconStyle = { opacity: 0.6 }

    if (isCanvas) {
        return (
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: props.gap,
                    alignItems: "center",
                    width: "100%",
                }}
            >
                <div style={tagStyle}>
                    <span>Prix: 100 - 500</span>
                    <svg
                        width="10"
                        height="10"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={iconStyle}
                    >
                        <line x1="2" y1="2" x2="10" y2="10" />
                        <line x1="10" y1="2" x2="2" y2="10" />
                    </svg>
                </div>
                {props.showClear && (
                    <div style={clearStyle}>{props.clearText}</div>
                )}
            </div>
        )
    }
    if (tags.length === 0) return null
    return (
        <div
            style={{
                display: "flex",
                flexWrap: "wrap",
                gap: props.gap,
                alignItems: "center",
                width: "100%",
            }}
        >
            {tags.map((tag) => (
                <div
                    key={tag.id}
                    onClick={() => removeTag(tag)}
                    style={tagStyle}
                    onMouseEnter={(e) =>
                        (e.currentTarget.style.opacity = "0.7")
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                    <span>{tag.label}</span>
                    <div
                        style={{
                            width: 20, // Slightly smaller for tags to fit better
                            height: 20,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: "50%",
                            transition: "background 0.2s, color 0.2s",
                            marginLeft: 2,
                        }}
                        onMouseEnter={(e) => {
                            e.stopPropagation()
                            e.currentTarget.style.background = "#E0E0E0"
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent"
                        }}
                    >
                        <svg
                            width="10"
                            height="10"
                            viewBox="0 0 12 12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="2" y1="2" x2="10" y2="10" />
                            <line x1="10" y1="2" x2="2" y2="10" />
                        </svg>
                    </div>
                </div>
            ))}
            {props.showClear && (
                <div onClick={clearAll} style={clearStyle}>
                    {props.clearText}
                </div>
            )}
        </div>
    )
}

addPropertyControls(BroadcastActiveTags, {
    showClear: {
        type: ControlType.Boolean,
        title: "Show Clear",
        defaultValue: true,
    },
    clearText: {
        type: ControlType.String,
        title: "Clear Text",
        defaultValue: "Effacer tout",
        hidden: (p) => !p.showClear,
    },
    clearColor: {
        type: ControlType.Color,
        title: "Clear Color",
        defaultValue: "#666666",
        hidden: (p) => !p.showClear,
    },
    gap: { type: ControlType.Number, title: "Gap", defaultValue: 8 },
    padding: {
        type: ControlType.Padding,
        title: "Padding",
        defaultValue: "6px 12px",
    },
    borderRadius: {
        type: ControlType.BorderRadius,
        title: "Radius",
        defaultValue: "4px",
    },
    tagBackground: {
        type: ControlType.Color,
        title: "Tag Bg",
        defaultValue: "#F3F3F3",
    },
    tagColor: {
        type: ControlType.Color,
        title: "Tag Text",
        defaultValue: "#333333",
    },
    border: {
        type: ControlType.Border,
        title: "Tag Border",
        defaultValue: {
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: "#E5E5E5",
        },
    },
    font: {
        type: ControlType.Font,
        controls: "extended",
        title: "Font",
        defaultValue: { fontSize: 13 },
    },
})
