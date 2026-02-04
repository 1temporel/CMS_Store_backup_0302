import React, { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { addPropertyControls, ControlType } from "framer"
import { motion } from "framer-motion"
import { store, FilterState } from "./store.ts"

// --- HELPERS ---
const extractNumber = (str) => {
    return (
        parseFloat(
            str.match(/-?[\d,]+\.?\d*/g)?.[0]?.replace(/,/g, "") || "0"
        ) || 0
    )
}
const parseDate = (dateString) => {
    return new Date(dateString).getTime() || 0
}

const getSortValue = (element, field) => {
    const sortDataAttr = element.querySelector(
        `[data-framer-name="${field}"], [data-sort="${field}"]`
    )
    if (sortDataAttr) return sortDataAttr.textContent || ""
    return element.textContent || ""
}

const compareValues = (a, b, type) => {
    if (a === undefined || a === null) return -1
    if (b === undefined || b === null) return 1
    const aStr = a.toString()
    const bStr = b.toString()
    if (type === "number") return extractNumber(aStr) - extractNumber(bStr)
    else if (type === "date") return parseDate(aStr) - parseDate(bStr)
    else return aStr.localeCompare(bStr)
}

/**
 * @framerDisableUnlink
 * @framerIntrinsicWidth 250
 * @framerIntrinsicHeight 48
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
export default function BroadcastSort(props) {
    const [isOpen, setIsOpen] = useState(false)
    const [isHovered, setIsHovered] = useState(false)
    const BROADCAST_ID = "3.14px solid transparent"
    const containerRef = useRef(null)

    // On garde en mémoire le tri actif
    const activeSortRef = useRef(null)

    // MISSING STATE
    const [selectedOption, setSelectedOption] = useState("")

    const parseSortOptions = useCallback(() => {
        if (!props.sortOptions || !Array.isArray(props.sortOptions)) return []
        return props.sortOptions
            .map((option) => {
                if (!option.field || !option.type) return null
                return {
                    field: option.field
                        .trim()
                        .toLowerCase()
                        .replace(/\s+/g, "_"),
                    display: option.ascendingOptionText,
                    // Actually the design maps index click to optionData.
                    // But we need 'display' property for the list.
                    // Let's create two entries per option? Or just one?
                    // The UI shows a list of clickable options.
                    // Loop below suggests commandOptions.map

                    // Let's reconstruct commandOptions properly based on typical usage
                    type: option.type.toLowerCase(),
                    // We need separate objects for Asc and Desc if we want them as separate menu items?
                    // props.sortOptions seems to define a Field + Type + LabelAsc + LabelDesc
                    // So we should generate *two* command options per sortOption entry?
                    // Let's see handleOptionClick (index -> commandOptions[index])
                    // And props.defaultValue has 2 entries.

                    // So parseSortOptions should return a flat list?
                    // Revisiting logic below.
                }
            })
            .filter(Boolean)
    }, [props.sortOptions])

    const commandOptions = useMemo(() => {
        if (!props.sortOptions) return []
        return props.sortOptions
            .flatMap((opt) => {
                const field = opt.field
                    .trim()
                    .toLowerCase()
                    .replace(/\s+/g, "_")
                return [
                    {
                        display: opt.ascendingOptionText,
                        field: field,
                        direction: "asc",
                        type: opt.type.toLowerCase(),
                    },
                    {
                        display: opt.descendingOptionText,
                        field: field,
                        direction: "desc",
                        type: opt.type.toLowerCase(),
                    },
                ]
            })
            .filter((opt) => opt.display && opt.display.trim() !== "")
    }, [props.sortOptions])

    // --- STORE INTEGRATION ---
    useEffect(() => {
        // Sync local UI with store (e.g. regarding Reset)
        const unsubscribe = store.subscribe((state) => {
            const { sortConfig } = state
            if (!sortConfig.field && selectedOption !== "") {
                setSelectedOption("")
                activeSortRef.current = null
            }
        })
        return unsubscribe
    }, [selectedOption])

    // --- HANDLERS UI ---
    const handleOptionClick = (index) => {
        const optionData = commandOptions[index]
        setIsOpen(false)
        setSelectedOption(optionData.display)

        // Dispatch to store
        store.setSort(
            optionData.field,
            optionData.direction,
            optionData.type as any
        )
    }

    const handleClear = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation()
        setSelectedOption("")
        setIsOpen(false)
        store.setSort(null, "asc")
    }

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target)
            ) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () =>
            document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    // --- STYLES ---
    const isActive = selectedOption !== ""
    const getDisplayTitle = () =>
        selectedOption === "" ? props.defaultText : selectedOption

    const {
        selectorStyle,
        activeStyle,
        dropdownStyle,
        optionStyle,
        dropdownGap,
        iconStyle,
        transition,
        clearIconStyle,
    } = props

    const getCurrentBackground = () =>
        isHovered
            ? isActive
                ? activeStyle.hoverBackground
                : selectorStyle.hoverBackground
            : isActive
              ? activeStyle.background
              : selectorStyle.background

    const getCurrentShadow = () =>
        isHovered
            ? isActive
                ? activeStyle.hoverShadow
                : selectorStyle.hoverShadow
            : isActive
              ? activeStyle.shadow
              : selectorStyle.shadow

    const paddingVal =
        typeof clearIconStyle.padding === "number" ? clearIconStyle.padding : 4
    const negativeMargin = `-${paddingVal}px`

    return (
        <div
            ref={containerRef}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                userSelect: "none",
            }}
        >
            {/* BOUTON SELECTEUR */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                style={{
                    padding: selectorStyle.padding,
                    background: getCurrentBackground(),
                    borderRadius: selectorStyle.borderRadius,
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    boxShadow: getCurrentShadow(),
                    border: isActive
                        ? `${activeStyle.border.borderWidth}px ${activeStyle.border.borderStyle} ${activeStyle.border.borderColor}`
                        : `${selectorStyle.border.borderWidth}px ${selectorStyle.border.borderStyle} ${selectorStyle.border.borderColor}`,
                    color: isActive
                        ? activeStyle.textColor
                        : selectorStyle.textColor,
                    ...(isActive ? activeStyle.font : selectorStyle.font),
                    transition: "all 0.15s ease",
                    height: "100%",
                    boxSizing: "border-box",
                }}
            >
                <div
                    style={{
                        marginRight: selectorStyle.iconGap,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        pointerEvents: "none",
                    }}
                >
                    {getDisplayTitle()}
                </div>

                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexShrink: 0,
                        height: "100%",
                    }}
                >
                    {isActive && (
                        <div
                            role="button"
                            onClick={handleClear}
                            style={{
                                width: 24,
                                height: 24,
                                background: "transparent",
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                transition: "background 0.2s, color 0.2s",
                                color: clearIconStyle.color || "#999",
                                marginRight: -7,
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background =
                                    clearIconStyle.hoverBackground || "#FFF0F0"
                                e.currentTarget.style.color =
                                    clearIconStyle.hoverColor || "#EC2222"
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = "transparent"
                                e.currentTarget.style.color =
                                    clearIconStyle.color || "#999"
                            }}
                        >
                            <svg
                                width={clearIconStyle.size || 10}
                                height={clearIconStyle.size || 10}
                                viewBox="0 0 12 12"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={clearIconStyle.strokeWidth || 2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <line x1="2" y1="2" x2="10" y2="10" />
                                <line x1="10" y1="2" x2="2" y2="10" />
                            </svg>
                        </div>
                    )}
                    {isActive && (
                        <div
                            style={{
                                width: "1px",
                                height: "14px",
                                background:
                                    clearIconStyle.separatorColor || "#E0E0E0",
                                marginLeft: "-2px",
                                marginRight: "2px",
                            }}
                        />
                    )}
                    {selectorStyle.showArrow && (
                        <motion.div
                            animate={{ rotate: isOpen ? 180 : 0 }}
                            transition={transition}
                        >
                            <svg
                                width={iconStyle.size}
                                height={iconStyle.size}
                                viewBox="0 0 12 8"
                                fill="none"
                            >
                                <path
                                    d="M1 1.5L6 6.5L11 1.5"
                                    stroke={
                                        isActive
                                            ? activeStyle.iconColor
                                            : iconStyle.color
                                    }
                                    strokeWidth={iconStyle.strokeWidth}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* DROPDOWN */}
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={transition}
                    style={{
                        position: "absolute",
                        top: `calc(100% + ${dropdownGap}px)`,
                        left: 0,
                        minWidth: dropdownStyle.minWidth || "100%",
                        maxHeight: dropdownStyle.maxHeight || "300px",
                        zIndex: 1000,
                        background: dropdownStyle.background,
                        borderRadius: dropdownStyle.borderRadius,
                        boxShadow: dropdownStyle.shadow,
                        overflow: "auto",
                        border: `${dropdownStyle.border.borderWidth}px ${dropdownStyle.border.borderStyle} ${dropdownStyle.border.borderColor}`,
                        padding: dropdownStyle.padding,
                        display: "flex",
                        flexDirection: "column",
                        gap: dropdownStyle.itemGap,
                    }}
                >
                    {commandOptions.map((option, index) => {
                        const isSelected = option.display === selectedOption
                        return (
                            <motion.div
                                key={index}
                                onClick={() => handleOptionClick(index)}
                                style={{
                                    padding: optionStyle.padding,
                                    cursor: "pointer",
                                    background: isSelected
                                        ? optionStyle.activeBackground
                                        : optionStyle.background,
                                    color: isSelected
                                        ? optionStyle.activeColor
                                        : optionStyle.color,
                                    ...optionStyle.font,
                                    whiteSpace: "nowrap",
                                    borderRadius: optionStyle.borderRadius,
                                }}
                                whileHover={{
                                    backgroundColor:
                                        optionStyle.hoverBackground,
                                }}
                            >
                                {option.display}
                            </motion.div>
                        )
                    })}
                </motion.div>
            )}
        </div>
    )
}

addPropertyControls(BroadcastSort, {
    defaultText: {
        type: ControlType.String,
        title: "Texte par défaut",
        defaultValue: "Trier par",
    },
    defaultSortIndex: {
        type: ControlType.Number,
        title: "Default Index",
        defaultValue: -1,
        min: -1,
    },
    sortOptions: {
        type: ControlType.Array,
        title: "Options de Tri",
        control: {
            type: ControlType.Object,
            controls: {
                field: {
                    type: ControlType.String,
                    title: "Field",
                    defaultValue: "Title",
                },
                type: {
                    type: ControlType.Enum,
                    title: "Type",
                    options: ["String", "Number", "Date"],
                    defaultValue: "String",
                },
                ascendingOptionText: {
                    type: ControlType.String,
                    title: "Croissant Text",
                    defaultValue: "Croissant",
                },
                descendingOptionText: {
                    type: ControlType.String,
                    title: "Décroissant Text",
                    defaultValue: "Décroissant",
                },
            },
        },
        defaultValue: [
            {
                field: "Title",
                type: "String",
                ascendingOptionText: "Titre A-Z",
                descendingOptionText: "Titre Z-A",
            },
            {
                field: "Price",
                type: "Number",
                ascendingOptionText: "Prix croissant",
                descendingOptionText: "Prix décroissant",
            },
        ],
    },
    dropdownGap: { type: ControlType.Number, defaultValue: 8 },
    transition: {
        type: ControlType.Transition,
        defaultValue: { type: "spring", stiffness: 300, damping: 30 },
    },
    iconStyle: {
        type: ControlType.Object,
        controls: {
            size: { type: ControlType.Number, defaultValue: 12 },
            color: { type: ControlType.Color, defaultValue: "#333" },
            strokeWidth: { type: ControlType.Number, defaultValue: 2 },
        },
    },
    selectorStyle: {
        type: ControlType.Object,
        title: "Default Style",
        controls: {
            showArrow: { type: ControlType.Boolean, defaultValue: true },
            iconGap: { type: ControlType.Number, defaultValue: 8 },
            textColor: { type: ControlType.Color, defaultValue: "#333" },
            font: { type: ControlType.Font, controls: "extended" },
            padding: { type: ControlType.Padding, defaultValue: "12px 16px" },
            background: { type: ControlType.Color, defaultValue: "#FFF" },
            hoverBackground: {
                type: ControlType.Color,
                defaultValue: "#F5F5F5",
            },
            borderRadius: {
                type: ControlType.BorderRadius,
                defaultValue: "8px",
            },
            shadow: { type: ControlType.BoxShadow },
            hoverShadow: { type: ControlType.BoxShadow },
            border: {
                type: ControlType.Border,
                defaultValue: {
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: "#E0E0E0",
                },
            },
        },
    },
    activeStyle: {
        type: ControlType.Object,
        title: "Active Style",
        controls: {
            textColor: { type: ControlType.Color, defaultValue: "#594FEE" },
            iconColor: { type: ControlType.Color, defaultValue: "#594FEE" },
            font: { type: ControlType.Font, controls: "extended" },
            background: { type: ControlType.Color, defaultValue: "#EEEDFD" },
            hoverBackground: {
                type: ControlType.Color,
                defaultValue: "#E5E2FF",
            },
            shadow: { type: ControlType.BoxShadow },
            hoverShadow: { type: ControlType.BoxShadow },
            border: {
                type: ControlType.Border,
                defaultValue: {
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: "#594FEE",
                },
            },
        },
    },
    dropdownStyle: {
        type: ControlType.Object,
        title: "Dropdown Style",
        controls: {
            background: { type: ControlType.Color, defaultValue: "#FFF" },
            borderRadius: {
                type: ControlType.BorderRadius,
                defaultValue: "8px",
            },
            padding: { type: ControlType.Padding, defaultValue: "4px" },
            itemGap: { type: ControlType.Number, defaultValue: 2 },
            minWidth: { type: ControlType.String, defaultValue: "100%" },
            maxHeight: { type: ControlType.String, defaultValue: "300px" },
            shadow: { type: ControlType.BoxShadow },
            border: {
                type: ControlType.Border,
                defaultValue: {
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: "#E0E0E0",
                },
            },
        },
    },
    optionStyle: {
        type: ControlType.Object,
        title: "Option Style",
        controls: {
            font: { type: ControlType.Font, controls: "extended" },
            padding: { type: ControlType.Padding, defaultValue: "10px 16px" },
            borderRadius: {
                type: ControlType.BorderRadius,
                defaultValue: "4px",
            },
            background: { type: ControlType.Color, defaultValue: "#FFF" },
            hoverBackground: {
                type: ControlType.Color,
                defaultValue: "#F5F5F5",
            },
            activeBackground: {
                type: ControlType.Color,
                defaultValue: "#F0F0F0",
            },
            color: { type: ControlType.Color, defaultValue: "#333" },
            activeColor: { type: ControlType.Color, defaultValue: "#000" },
        },
    },
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
