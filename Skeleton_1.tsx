import { useEffect, useState } from "react"
import { addPropertyControls, ControlType } from "framer"
import { store } from "./store.ts"

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
export default function SkeletonLoader(props) {
    const {
        bgColor = "#ffffff",
        accentColor = "#3b82f6",
        fadeDuration = 0.4,
        loadingText = "Chargement...",
        showText = true,
        showProgressBar = true,
    } = props

    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const unsubscribe = store.subscribe((state) => {
            if (state.filteredItems.length > 0 || state.items.length > 0) {
                setTimeout(() => setIsLoading(false), 100)
            }
        })

        return unsubscribe
    }, [])

    if (!isLoading) return null

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                backgroundColor: bgColor,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 24,
                opacity: isLoading ? 1 : 0,
                transition: `opacity ${fadeDuration}s ease`,
                pointerEvents: isLoading ? "auto" : "none",
            }}
        >
            {/* Animated dots loader */}
            <div style={{ display: "flex", gap: 8 }}>
                {[0, 1, 2].map((i) => (
                    <div
                        key={i}
                        style={{
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            backgroundColor: accentColor,
                            animation: `bounce 1.4s ease-in-out ${i * 0.16}s infinite both`,
                        }}
                    />
                ))}
            </div>

            {/* Loading text */}
            {showText && (
                <div
                    style={{
                        fontSize: 16,
                        fontWeight: 500,
                        color: accentColor,
                        opacity: 0.8,
                    }}
                >
                    {loadingText}
                </div>
            )}

            {/* Progress bar */}
            {showProgressBar && (
                <div
                    style={{
                        width: 200,
                        height: 3,
                        backgroundColor: `${accentColor}20`,
                        borderRadius: 2,
                        overflow: "hidden",
                    }}
                >
                    <div
                        style={{
                            width: "30%",
                            height: "100%",
                            backgroundColor: accentColor,
                            borderRadius: 2,
                            animation: "progress 1.5s ease-in-out infinite",
                        }}
                    />
                </div>
            )}

            <style>
                {`
                    @keyframes bounce {
                        0%, 80%, 100% {
                            transform: scale(0.6);
                            opacity: 0.5;
                        }
                        40% {
                            transform: scale(1);
                            opacity: 1;
                        }
                    }
                    @keyframes progress {
                        0% {
                            transform: translateX(-100%);
                        }
                        50% {
                            transform: translateX(250%);
                        }
                        100% {
                            transform: translateX(-100%);
                        }
                    }
                `}
            </style>
        </div>
    )
}

addPropertyControls(SkeletonLoader, {
    bgColor: {
        type: ControlType.Color,
        title: "Couleur fond",
        defaultValue: "#ffffff",
    },
    accentColor: {
        type: ControlType.Color,
        title: "Couleur accent",
        defaultValue: "#3b82f6",
    },
    loadingText: {
        type: ControlType.String,
        title: "Texte",
        defaultValue: "Chargement...",
    },
    showText: {
        type: ControlType.Boolean,
        title: "Afficher texte",
        defaultValue: true,
    },
    showProgressBar: {
        type: ControlType.Boolean,
        title: "Afficher barre",
        defaultValue: true,
    },
    fadeDuration: {
        type: ControlType.Number,
        title: "Durée fade",
        defaultValue: 0.4,
        min: 0,
        max: 1,
        step: 0.1,
        unit: "s",
    },
})
