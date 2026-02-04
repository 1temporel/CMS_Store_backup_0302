import React, {
    useEffect,
    useState,
    useRef,
    useTransition,
    useMemo,
} from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"
import { store } from "./store.ts"

/**
 * @framerDisableUnlink
 * @framerIntrinsicWidth 250
 * @framerIntrinsicHeight 48
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
export default function BroadcastSearch(props) {
    const [searchQuery, setSearchQuery] = useState(store.state.searchQuery)
    const [isPending, startTransition] = useTransition()
    const BROADCAST_ID = "3.14px solid transparent"
    const RESET_EVENT = "reset-broadcast-filters"

    const uniqueId = useRef(
        `broadcast-search-${Math.random().toString(36).substring(2, 11)}`
    )

    // --- HELPER: ANALYSE DU PADDING FRAMER ---
    // Transforme "10px" ou "10px 20px" en objets {top, right, bottom, left} chiffrés
    const getPaddingValues = (paddingStr) => {
        const defaultPadding = 10
        if (!paddingStr)
            return {
                top: defaultPadding,
                right: defaultPadding,
                bottom: defaultPadding,
                left: defaultPadding,
            }

        // Si c'est juste un nombre
        if (typeof paddingStr === "number") {
            return {
                top: paddingStr,
                right: paddingStr,
                bottom: paddingStr,
                left: paddingStr,
            }
        }

        // Nettoyage de la chaîne "10px" -> 10
        const parts = paddingStr
            .toString()
            .split(" ")
            .map((p) => parseFloat(p) || 0)

        switch (parts.length) {
            case 1:
                return {
                    top: parts[0],
                    right: parts[0],
                    bottom: parts[0],
                    left: parts[0],
                }
            case 2:
                return {
                    top: parts[0],
                    right: parts[1],
                    bottom: parts[0],
                    left: parts[1],
                }
            case 3:
                return {
                    top: parts[0],
                    right: parts[1],
                    bottom: parts[2],
                    left: parts[1],
                }
            case 4:
                return {
                    top: parts[0],
                    right: parts[1],
                    bottom: parts[2],
                    left: parts[3],
                }
            default:
                return {
                    top: defaultPadding,
                    right: defaultPadding,
                    bottom: defaultPadding,
                    left: defaultPadding,
                }
        }
    }

    // Calcul des positions dynamiques
    const paddings = useMemo(
        () => getPaddingValues(props.inputPadding),
        [props.inputPadding]
    )

    // Configuration des tailles
    const iconSize = 16
    const iconGap = 12 // Espace entre l'icône et le texte
    const clearIconSize = props.clearIconStyle?.size || 10
    const clearIconTouchTarget = 24 // Zone de clic pour la croix

    // Calcul du padding interne du texte pour ne pas chevaucher les icônes
    const textPaddingLeft = props.showSearchIcon
        ? paddings.left + iconSize + iconGap
        : paddings.left

    const textPaddingRight = searchQuery
        ? paddings.right + clearIconSize + iconGap + 8 // +8 pour compenser le padding de la croix
        : paddings.right

    // --- FONCTION DE NORMALISATION ---
    const normalizeText = (text) => {
        if (!text) return ""
        return text
            .toString()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
    }

    // --- LOGIQUE ---
    const searchQueryRef = useRef(searchQuery)
    const isCanvas = RenderTarget.current() === RenderTarget.canvas

    useEffect(() => {
        if (isCanvas) return

        // Sync local state with store state (e.g. on reset)
        // Only run once on mount to avoid re-triggering immediate callbacks during typing
        const unsubscribe = store.subscribe((state) => {
            if (state.searchQuery !== searchQueryRef.current) {
                setSearchQuery(state.searchQuery)
            }
        })
        return unsubscribe
    }, [isCanvas])

    // Effect for handling search input changes with debounce potentially handled in store or UI
    // --- DEBOUNCE SEARCH ---
    const isFirstRun = useRef(true)

    useEffect(() => {
        if (isCanvas) return

        const timer = setTimeout(() => {
            startTransition(() => {
                // If it's the first run, prevent page reset to respect persisted page
                store.setSearch(searchQuery, isFirstRun.current)
                if (isFirstRun.current) {
                    isFirstRun.current = false
                }
            })
        }, 300) // 300ms debounce
        return () => clearTimeout(timer)
    }, [searchQuery, isCanvas])

    const handleSearchChange = (e) => setSearchQuery(e.target.value)

    const handleClear = () => {
        if (isCanvas) return
        setSearchQuery("")
        store.setSearch("")
        const input = document.getElementById(uniqueId.current)
        if (input) input.focus()
    }

    // Injection CSS
    useEffect(() => {
        const styleEl = document.createElement("style")
        styleEl.innerHTML = `
            #${uniqueId.current}::placeholder { color: ${props.placeholderColor}; }
            #${uniqueId.current}:focus { border-color: ${props.focusBorderColor} !important; }
        `
        document.head.appendChild(styleEl)
        return () => {
            document.head.removeChild(styleEl)
        }
    }, [props.placeholderColor, props.focusBorderColor])

    return (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
            <input
                id={uniqueId.current}
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder={props.placeholder}
                style={{
                    width: "100%",
                    height: "100%",
                    // Application des paddings calculés dynamiquement
                    paddingTop: paddings.top,
                    paddingBottom: paddings.bottom,
                    paddingLeft: textPaddingLeft,
                    paddingRight: textPaddingRight,

                    border: `${props.border.borderWidth}px ${props.border.borderStyle} ${props.border.borderColor}`,
                    borderRadius: props.borderRadius,
                    ...props.font,
                    color: props.fontColor,
                    backgroundColor: props.inputBackground,
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.2s ease",
                    // Fix vertical centering
                    lineHeight: "normal",
                }}
            />

            {/* ICONE LOUPE (Positionnée dynamiquement selon le padding gauche) */}
            {props.showSearchIcon && (
                <div
                    style={{
                        position: "absolute",
                        left: paddings.left, // Suit le padding défini dans Framer
                        top: "50%",
                        transform: "translateY(-50%)",
                        pointerEvents: "none",
                        display: "flex",
                        alignItems: "center",
                        color: props.iconColor,
                        height: "100%",
                        width: iconSize,
                        justifyContent: "center",
                    }}
                >
                    <svg
                        width={iconSize}
                        height={iconSize}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                </div>
            )}

            {/* ICONE CROIX (Positionnée dynamiquement selon le padding droit) */}
            {searchQuery && (
                <div
                    onClick={handleClear}
                    style={{
                        position: "absolute",
                        right: paddings.right, // Suit le padding défini dans Framer
                        top: "50%",
                        transform: "translateY(-50%)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: clearIconTouchTarget,
                        height: clearIconTouchTarget,
                        borderRadius: "50%",
                        background: "transparent",
                        color: props.clearIconStyle?.color || "#999",
                        transition: "background 0.2s, color 0.2s",
                        // Marge négative pour compenser la zone de clic et l'aligner visuellement
                        marginRight: -(
                            (clearIconTouchTarget - clearIconSize) /
                            2
                        ),
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                            props.clearIconStyle?.hoverBackground || "#FFF0F0"
                        e.currentTarget.style.color =
                            props.clearIconStyle?.hoverColor || "#EC2222"
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent"
                        e.currentTarget.style.color =
                            props.clearIconStyle?.color || "#999"
                    }}
                >
                    <svg
                        width={clearIconSize}
                        height={clearIconSize}
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={props.clearIconStyle?.strokeWidth || 2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <line x1="2" y1="2" x2="10" y2="10" />
                        <line x1="10" y1="2" x2="2" y2="10" />
                    </svg>
                </div>
            )}
        </div>
    )
}

BroadcastSearch.defaultProps = {
    placeholder: "Rechercher...",
    placeholderColor: "#888888",
    showSearchIcon: true,
    iconColor: "#888888",
    fontColor: "#000000",
    inputBackground: "white",
    inputPadding: "10px",
    borderRadius: "8px",
    border: { borderWidth: 1, borderStyle: "solid", borderColor: "#dddddd" },
    focusBorderColor: "#594FEE",
    font: {
        family: "Inter",
        fontSize: 14,
        fontWeight: 400,
        lineHeight: 1.5,
        textAlign: "left",
    },
    clearIconStyle: {
        size: 10,
        color: "#999999",
        hoverColor: "#EC2222",
        hoverBackground: "#FFF0F0",
    },
}

addPropertyControls(BroadcastSearch, {
    placeholder: {
        type: ControlType.String,
        title: "Placeholder",
        defaultValue: "Rechercher...",
    },
    placeholderColor: {
        type: ControlType.Color,
        title: "Placeholder Color",
        defaultValue: "#888888",
    },
    showSearchIcon: {
        type: ControlType.Boolean,
        title: "Show Icon",
        defaultValue: true,
    },
    iconColor: {
        type: ControlType.Color,
        title: "Icon Color",
        defaultValue: "#888888",
        hidden: (props) => !props.showSearchIcon,
    },
    fontColor: {
        type: ControlType.Color,
        title: "Font Color",
        defaultValue: "#000000",
    },
    inputBackground: {
        type: ControlType.Color,
        title: "Input Background",
        defaultValue: "white",
    },

    // PADDING UNIFORMISÉ
    inputPadding: {
        type: ControlType.Padding,
        title: "Padding",
        defaultValue: "10px 12px 10px 12px",
    },

    border: {
        type: ControlType.Border,
        title: "Border",
        defaultValue: {
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: "#dddddd",
        },
    },
    focusBorderColor: {
        type: ControlType.Color,
        title: "Focus Color",
        defaultValue: "#594FEE",
    },
    borderRadius: {
        type: ControlType.BorderRadius,
        title: "Border Radius",
        defaultValue: "8px",
    },
    font: { type: ControlType.Font, controls: "extended", title: "Font" },

    clearIconStyle: {
        type: ControlType.Object,
        title: "Clear Style",
        controls: {
            size: { type: ControlType.Number, defaultValue: 10 },
            color: { type: ControlType.Color, defaultValue: "#999999" },
            strokeWidth: { type: ControlType.Number, defaultValue: 2 },
            hoverColor: { type: ControlType.Color, defaultValue: "#EC2222" },
            hoverBackground: {
                type: ControlType.Color,
                defaultValue: "#FFF0F0",
            },
            separatorColor: {
                type: ControlType.Color,
                defaultValue: "#E0E0E0",
            },
        },
    },
})
