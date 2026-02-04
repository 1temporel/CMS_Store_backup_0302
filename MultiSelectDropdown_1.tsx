import React, {
    useState,
    useRef,
    useEffect,
    useCallback,
    startTransition,
} from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"
import { motion } from "framer-motion"
import { store, FilterState } from "./store.ts"

// --- HOOK DE PERSISTANCE ---
function usePersistentState(key, initialValue, isEnabled) {
    const [state, setState] = useState(() => {
        if (typeof window === "undefined") return initialValue
        if (!isEnabled) return initialValue
        try {
            const item = window.sessionStorage.getItem(key)
            return item ? JSON.parse(item) : initialValue
        } catch (error) {
            return initialValue
        }
    })

    useEffect(() => {
        if (typeof window !== "undefined" && isEnabled) {
            try {
                window.sessionStorage.setItem(key, JSON.stringify(state))
            } catch (e) {}
        }
    }, [key, state, isEnabled])

    return [state, (value) => startTransition(() => setState(value))]
}

/**
 * @framerDisableUnlink
 * @framerIntrinsicWidth 250
 * @framerIntrinsicHeight 48
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 */
export default function MultiSelectDropdown(props) {
    const { persistState = true } = props

    const [isOpen, setIsOpen] = useState(false)
    const [isHovered, setIsHovered] = useState(false)
    const [hoveredOptionIndex, setHoveredOptionIndex] = useState<number | null>(
        null
    )
    const [searchQuery, setSearchQuery] = useState("")
    const BROADCAST_ID = "3.14px solid transparent"
    const containerRef = useRef<HTMLDivElement>(null)
    const selectRef = useRef<HTMLDivElement>(null)

    // Clé unique pour le store
    const filterKey = `filter_multi_${(props.layerName || "").trim().toLowerCase().replace(/\s+/g, "_")}`

    // --- STATE ---
    const [selectedOptions, setSelectedOptions] = useState<string[]>(() => {
        return (store.state.activeFilters.get(filterKey) as string[]) || []
    })

    const isFirstRun = useRef(true)
    const [options, setOptions] = useState<string[]>([])

    const uniqueId = useRef(
        `multi-${(props.layerName || "default").replace(/[^a-zA-Z0-9-_]/g, "").toLowerCase()}`
    )

    const {
        borderWidth = 1,
        borderStyle = "solid",
        borderColor = "#000000",
    } = props.colorCircleBorder || {}

    const getColorForOption = (option) => {
        if (!props.couleurs || props.couleurs.length === 0) return null
        const colorMapping = props.couleurs.find(
            (c) => c.nom.trim().toLowerCase() === option.trim().toLowerCase()
        )
        return colorMapping ? colorMapping.hex : null
    }

    const isCanvas = RenderTarget.current() === RenderTarget.canvas

    // --- STORE INTEGRATION ---

    // 1. Fetch options from Store Items instead of DOM
    useEffect(() => {
        if (isCanvas) return

        const updateOptions = (state: FilterState) => {
            if (!props.layerName) return
            const key = props.layerName
                .trim()
                .toLowerCase()
                .replace(/\s+/g, "_")

            const uniqueValues = new Set<string>()
            state.items.forEach((item) => {
                const val = item[key]
                if (val) {
                    // Handle comma-separated values if needed (legacy behavior)
                    const parts = String(val)
                        .split(",")
                        .map((s) => s.trim())
                        .filter((s) => s)
                    parts.forEach((p) => uniqueValues.add(p))
                }
            })

            startTransition(() => {
                setOptions(Array.from(uniqueValues).sort())
            })
        }

        const unsubscribe = store.subscribe(updateOptions)
        return unsubscribe
    }, [props.layerName, isCanvas])

    // 2. Sync selectedOptions to Store
    useEffect(() => {
        if (isCanvas) return

        // Apply filter to store
        // If it's the first run (restoration), DO NOT reset the page.
        // If it's subsequent run (user click), RESET the page.
        store.setFilter(filterKey, selectedOptions, isFirstRun.current)

        if (isFirstRun.current) {
            isFirstRun.current = false
        }
    }, [selectedOptions, filterKey, isCanvas])

    // 3. Handle External Reset / Store updates
    useEffect(() => {
        if (isCanvas) return

        const unsubscribe = store.subscribe((state) => {
            const storeValue = state.activeFilters.get(filterKey) || []
            if (
                JSON.stringify(storeValue) !== JSON.stringify(selectedOptions)
            ) {
                setSelectedOptions(storeValue as string[])
            }
        })
        return unsubscribe
    }, [filterKey, selectedOptions, isCanvas])

    // REMOVED LEGACY fetchOptions and applyFilters
    // The previous effects calling them are also removed/replaced above.

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target)
            ) {
                startTransition(() => setIsOpen(false))
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () =>
            document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const toggleDropdown = () =>
        startTransition(() => setIsOpen((prev) => !prev))

    const handleOptionClick = (option) => {
        let newSelected = [...selectedOptions]
        if (selectedOptions.includes(option)) {
            newSelected = newSelected.filter((item) => item !== option)
        } else {
            newSelected.push(option)
        }
        setSelectedOptions(newSelected)
        // Store will be updated via effect
    }

    const handleClearFilters = () => {
        setSelectedOptions([])
        if (persistState) window.sessionStorage.removeItem(filterKey)
        // Store will be updated via effect
    }

    const filteredOptions = options.filter((option) =>
        option.toLowerCase().includes(searchQuery.toLowerCase())
    )
    const isActive = selectedOptions.length > 0

    const getDisplayTitle = () => {
        if (selectedOptions.length === 0) return props.placeholder
        if (selectedOptions.length === 1) return selectedOptions[0]
        if (selectedOptions.length === options.length && options.length > 0)
            return props.allSelectedText || "All Selected"
        if (props.multipleSelectedText.includes("{n}"))
            return props.multipleSelectedText.replace(
                "{n}",
                String(selectedOptions.length)
            )
        return selectedOptions.join(", ")
    }

    const {
        selectorStyle,
        activeStyle,
        dropdownStyle,
        optionStyle,
        checkboxStyle,
        dropdownGap,
        iconStyle,
        transition,
        clearIconStyle,
        featuredOptions,
        separatorStyle,
        featuredTitle,
        regularTitle,
        searchPlaceholder = "Search item...",
        searchIconStyle = {},
        showSearchIcon = true,
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
    const clearPaddingVal =
        typeof clearIconStyle.padding === "number" ? clearIconStyle.padding : 4
    const negativeMargin = `-${clearPaddingVal}px`

    return (
        <div
            ref={containerRef}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                userSelect: "none",
                ...(props.style || {}),
            }}
        >
            <div
                ref={selectRef}
                onClick={toggleDropdown}
                onMouseEnter={() => startTransition(() => setIsHovered(true))}
                onMouseLeave={() => startTransition(() => setIsHovered(false))}
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
                    overflow: "hidden",
                    transition: "all 0.15s ease",
                    width: "100%",
                    height: "100%",
                    boxSizing: "border-box",
                }}
            >
                {/* TITRE PRINCIPAL: Correction lineHeight et ellipsis */}
                <div
                    style={{
                        marginRight: selectorStyle.iconGap,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        flex: 1,
                        lineHeight: "1.5",
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
                    }}
                >
                    {isActive && (
                        <div
                            role="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                handleClearFilters()
                            }}
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
                                marginRight: -7, // Match Search component logic (clearIconTouchTarget - iconSize) / 2
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
                                alignSelf: "center",
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
                                        isHovered
                                            ? isActive
                                                ? activeStyle.iconColor
                                                : iconStyle.hoverColor
                                            : isActive
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
                        overflowX: "hidden",
                        overflowY: "auto",
                        border: `${dropdownStyle.border.borderWidth}px ${dropdownStyle.border.borderStyle} ${dropdownStyle.border.borderColor}`,
                        padding: 0,
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    <div
                        style={{
                            padding: dropdownStyle.padding,
                            position: "sticky",
                            top: 0,
                            background: dropdownStyle.background || "#FFFFFF",
                            zIndex: 10,
                            borderBottom: `${dropdownStyle.border?.borderWidth || 1}px ${dropdownStyle.border?.borderStyle || "solid"} ${dropdownStyle.border?.borderColor || "#E0E0E0"}`,
                            boxSizing: "border-box",
                        }}
                    >
                        {showSearchIcon && (
                            <div
                                style={{
                                    position: "absolute",
                                    left: 10,
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    pointerEvents: "none",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: searchIconStyle.color || "#B3B3B3",
                                }}
                            >
                                <svg
                                    width={searchIconStyle.size || 14}
                                    height={searchIconStyle.size || 14}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke={
                                        searchIconStyle.color || "currentColor"
                                    }
                                    strokeWidth={
                                        searchIconStyle.strokeWidth || 2
                                    }
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <circle cx="11" cy="11" r="6" />
                                    <line x1="16" y1="16" x2="20" y2="20" />
                                </svg>
                            </div>
                        )}
                        <input
                            type="text"
                            placeholder={searchPlaceholder}
                            value={searchQuery}
                            onChange={(e) =>
                                startTransition(() =>
                                    setSearchQuery(e.target.value)
                                )
                            }
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                width: "100%",
                                padding: showSearchIcon
                                    ? "8px 12px 8px 32px"
                                    : "8px 12px",
                                border: "none",
                                borderRadius: 0,
                                fontSize: "14px",
                                outline: "none",
                                boxSizing: "border-box",
                                background: "#FFFFFF",
                            }}
                        />
                    </div>
                    <div
                        style={{
                            padding: dropdownStyle.padding,
                            display: "flex",
                            flexDirection: "column",
                            gap: dropdownStyle.itemGap,
                            boxSizing: "border-box",
                        }}
                    >
                        {featuredOptions &&
                            featuredOptions.length > 0 &&
                            (() => {
                                const featured = filteredOptions.filter((opt) =>
                                    featuredOptions.includes(opt)
                                )
                                if (featured.length === 0) return null
                                return (
                                    <>
                                        {featuredTitle && (
                                            <div
                                                style={{
                                                    padding:
                                                        "8px 16px 4px 16px",
                                                    fontSize: "11px",
                                                    fontWeight: 600,
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.5px",
                                                    color: "#999999",
                                                    pointerEvents: "none",
                                                }}
                                            >
                                                {featuredTitle}
                                            </div>
                                        )}
                                        {featured.map((option) => {
                                            const index =
                                                options.indexOf(option)
                                            const isSelected =
                                                selectedOptions.includes(option)
                                            const isOptionHovered =
                                                hoveredOptionIndex === index
                                            const optionColor =
                                                getColorForOption(option)
                                            return (
                                                <div
                                                    key={`featured-${index}`}
                                                    onClick={() =>
                                                        handleOptionClick(
                                                            option
                                                        )
                                                    }
                                                    onMouseEnter={() =>
                                                        startTransition(() =>
                                                            setHoveredOptionIndex(
                                                                index
                                                            )
                                                        )
                                                    }
                                                    onMouseLeave={() =>
                                                        startTransition(() =>
                                                            setHoveredOptionIndex(
                                                                null
                                                            )
                                                        )
                                                    }
                                                    style={{
                                                        padding:
                                                            optionStyle.padding,
                                                        cursor: "pointer",
                                                        background:
                                                            isOptionHovered
                                                                ? isSelected
                                                                    ? optionStyle.activeHoverBackground
                                                                    : optionStyle.hoverBackground
                                                                : isSelected
                                                                  ? optionStyle.activeBackground
                                                                  : optionStyle.background,
                                                        color: isSelected
                                                            ? optionStyle.activeColor
                                                            : optionStyle.color,
                                                        ...optionStyle.font,
                                                        borderRadius:
                                                            optionStyle.borderRadius,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        transition:
                                                            "background-color 0.15s ease",
                                                        // CORRECTION OPTION :
                                                        whiteSpace: "nowrap",
                                                        overflow: "hidden",
                                                        textOverflow:
                                                            "ellipsis",
                                                        lineHeight: "1.5",
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            width: checkboxStyle.size,
                                                            height: checkboxStyle.size,
                                                            borderRadius:
                                                                checkboxStyle.borderRadius,
                                                            border: isSelected
                                                                ? "none"
                                                                : `${checkboxStyle.borderWidth}px solid ${checkboxStyle.borderColor}`,
                                                            background:
                                                                isSelected
                                                                    ? checkboxStyle.checkedBackground
                                                                    : checkboxStyle.background,
                                                            marginRight:
                                                                optionStyle.checkboxGap,
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            justifyContent:
                                                                "center",
                                                            flexShrink: 0,
                                                            pointerEvents:
                                                                "none",
                                                        }}
                                                    >
                                                        {isSelected && (
                                                            <svg
                                                                width={
                                                                    checkboxStyle.size *
                                                                    0.6
                                                                }
                                                                height={
                                                                    checkboxStyle.size *
                                                                    0.6
                                                                }
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                            >
                                                                <path
                                                                    d="M5 12L10 17L19 8"
                                                                    stroke={
                                                                        checkboxStyle.checkColor
                                                                    }
                                                                    strokeWidth="3"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                />
                                                            </svg>
                                                        )}
                                                    </div>
                                                    {optionColor && (
                                                        <div
                                                            style={{
                                                                width: checkboxStyle.size,
                                                                height: checkboxStyle.size,
                                                                borderRadius:
                                                                    checkboxStyle.size /
                                                                    2,
                                                                background:
                                                                    optionColor,
                                                                marginRight:
                                                                    optionStyle.checkboxGap,
                                                                flexShrink: 0,
                                                                pointerEvents:
                                                                    "none",
                                                                border: `${borderWidth}px ${borderStyle} ${borderColor}`,
                                                            }}
                                                        />
                                                    )}
                                                    <span
                                                        style={{
                                                            pointerEvents:
                                                                "none",
                                                        }}
                                                    >
                                                        {option}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                        <div
                                            style={{
                                                width: "100%",
                                                borderBottom: `${separatorStyle.height}px solid ${separatorStyle.color}`,
                                                marginTop:
                                                    separatorStyle.margin,
                                                marginBottom:
                                                    separatorStyle.margin,
                                            }}
                                        />
                                    </>
                                )
                            })()}
                        {regularTitle &&
                            filteredOptions.filter(
                                (opt) =>
                                    !featuredOptions ||
                                    !featuredOptions.includes(opt)
                            ).length > 0 && (
                                <div
                                    style={{
                                        padding: "8px 16px 4px 16px",
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.5px",
                                        color: "#999999",
                                        pointerEvents: "none",
                                    }}
                                >
                                    {regularTitle}
                                </div>
                            )}
                        {filteredOptions
                            .filter(
                                (opt) =>
                                    !featuredOptions ||
                                    !featuredOptions.includes(opt)
                            )
                            .map((option) => {
                                const index = options.indexOf(option)
                                const isSelected =
                                    selectedOptions.includes(option)
                                const isOptionHovered =
                                    hoveredOptionIndex === index
                                const optionColor = getColorForOption(option)
                                return (
                                    <div
                                        key={index}
                                        onClick={() =>
                                            handleOptionClick(option)
                                        }
                                        onMouseEnter={() =>
                                            startTransition(() =>
                                                setHoveredOptionIndex(index)
                                            )
                                        }
                                        onMouseLeave={() =>
                                            startTransition(() =>
                                                setHoveredOptionIndex(null)
                                            )
                                        }
                                        style={{
                                            padding: optionStyle.padding,
                                            cursor: "pointer",
                                            background: isOptionHovered
                                                ? isSelected
                                                    ? optionStyle.activeHoverBackground
                                                    : optionStyle.hoverBackground
                                                : isSelected
                                                  ? optionStyle.activeBackground
                                                  : optionStyle.background,
                                            color: isSelected
                                                ? optionStyle.activeColor
                                                : optionStyle.color,
                                            ...optionStyle.font,
                                            borderRadius:
                                                optionStyle.borderRadius,
                                            display: "flex",
                                            alignItems: "center",
                                            transition:
                                                "background-color 0.15s ease",
                                            // CORRECTION OPTION :
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            lineHeight: "1.5",
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: checkboxStyle.size,
                                                height: checkboxStyle.size,
                                                borderRadius:
                                                    checkboxStyle.borderRadius,
                                                border: isSelected
                                                    ? "none"
                                                    : `${checkboxStyle.borderWidth}px solid ${checkboxStyle.borderColor}`,
                                                background: isSelected
                                                    ? checkboxStyle.checkedBackground
                                                    : checkboxStyle.background,
                                                marginRight:
                                                    optionStyle.checkboxGap,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                flexShrink: 0,
                                                pointerEvents: "none",
                                            }}
                                        >
                                            {isSelected && (
                                                <svg
                                                    width={
                                                        checkboxStyle.size * 0.6
                                                    }
                                                    height={
                                                        checkboxStyle.size * 0.6
                                                    }
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                >
                                                    <path
                                                        d="M5 12L10 17L19 8"
                                                        stroke={
                                                            checkboxStyle.checkColor
                                                        }
                                                        strokeWidth="3"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    />
                                                </svg>
                                            )}
                                        </div>
                                        {optionColor && (
                                            <div
                                                style={{
                                                    width: checkboxStyle.size,
                                                    height: checkboxStyle.size,
                                                    borderRadius:
                                                        checkboxStyle.size / 2,
                                                    background: optionColor,
                                                    marginRight:
                                                        optionStyle.checkboxGap,
                                                    flexShrink: 0,
                                                    pointerEvents: "none",
                                                    border: `${borderWidth}px ${borderStyle} ${borderColor}`,
                                                }}
                                            />
                                        )}
                                        <span style={{ pointerEvents: "none" }}>
                                            {option}
                                        </span>
                                    </div>
                                )
                            })}
                    </div>
                </motion.div>
            )}
        </div>
    )
}

addPropertyControls(MultiSelectDropdown, {
    persistState: {
        type: ControlType.Boolean,
        title: "Persist State",
        defaultValue: true,
        description: "Keep selection after page reload",
    },
    layerName: {
        type: ControlType.String,
        title: "Layer Name",
        defaultValue: "Title",
        description: "Must match Framer layer name. KEEP UNIQUE.",
    },
    featuredOptions: {
        type: ControlType.Array,
        title: "Featured Options",
        control: { type: ControlType.String },
        defaultValue: [],
        description: "Options to display at the top",
    },
    featuredTitle: {
        type: ControlType.String,
        title: "Featured Title",
        defaultValue: "",
        description: "Title for featured section",
    },
    regularTitle: {
        type: ControlType.String,
        title: "Regular Title",
        defaultValue: "",
        description: "Title for regular section",
    },
    placeholder: {
        type: ControlType.String,
        title: "Placeholder",
        defaultValue: "Select options",
    },
    allSelectedText: {
        type: ControlType.String,
        title: "All Selected Text",
        defaultValue: "All Selected",
    },
    multipleSelectedText: {
        type: ControlType.String,
        title: "Multiple Selected Text",
        defaultValue: "{n} Selected",
    },
    searchPlaceholder: {
        type: ControlType.String,
        title: "Search Placeholder",
        defaultValue: "Search item...",
    },
    showSearchIcon: {
        type: ControlType.Boolean,
        title: "Show Search Icon",
        defaultValue: true,
    },
    couleurs: {
        type: ControlType.Array,
        title: "Couleurs",
        control: {
            type: ControlType.Object,
            controls: {
                nom: {
                    type: ControlType.String,
                    title: "Nom",
                    defaultValue: "rouge",
                },
                hex: {
                    type: ControlType.String,
                    title: "Hex",
                    defaultValue: "#FF0000",
                },
            },
        },
        defaultValue: [],
    },
    colorCircleBorder: {
        type: ControlType.Border,
        title: "Color Border",
        defaultValue: {
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: "#000000",
        },
    },
    dropdownGap: {
        type: ControlType.Number,
        title: "Dropdown Gap",
        defaultValue: 8,
        min: 0,
        max: 50,
        step: 1,
    },
    transition: {
        type: ControlType.Transition,
        title: "Transition",
        defaultValue: { type: "spring", stiffness: 300, damping: 30 },
    },
    separatorStyle: {
        type: ControlType.Object,
        title: "Separator Style",
        controls: {
            height: { type: ControlType.Number, defaultValue: 1 },
            color: { type: ControlType.Color, defaultValue: "#E0E0E0" },
            margin: { type: ControlType.Number, defaultValue: 4 },
        },
    },
    iconStyle: {
        type: ControlType.Object,
        title: "Icon Style",
        controls: {
            size: { type: ControlType.Number, defaultValue: 12 },
            color: { type: ControlType.Color, defaultValue: "#333333" },
            hoverColor: { type: ControlType.Color, defaultValue: "#000000" },
            strokeWidth: { type: ControlType.Number, defaultValue: 2 },
        },
    },
    selectorStyle: {
        type: ControlType.Object,
        title: "Default Style",
        controls: {
            showArrow: { type: ControlType.Boolean, defaultValue: true },
            iconGap: { type: ControlType.Number, defaultValue: 8 },
            textColor: { type: ControlType.Color, defaultValue: "#333333" },
            font: {
                type: ControlType.Font,
                controls: "extended",
                defaultFontType: "sans-serif",
                defaultValue: {
                    fontSize: "15px",
                    variant: "Medium",
                    letterSpacing: "-0.01em",
                    lineHeight: "1.3em",
                },
            },
            padding: { type: ControlType.Padding, defaultValue: "0px 16px" }, // PADDING 16px PAR DÉFAUT
            background: { type: ControlType.Color, defaultValue: "#FFFFFF" },
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
            font: {
                type: ControlType.Font,
                controls: "extended",
                defaultFontType: "sans-serif",
                defaultValue: {
                    fontSize: "15px",
                    variant: "Semibold",
                    letterSpacing: "-0.01em",
                    lineHeight: "1.3em",
                },
            },
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
    dropdownStyle: {
        type: ControlType.Object,
        title: "Dropdown Style",
        controls: {
            background: { type: ControlType.Color, defaultValue: "#FFFFFF" },
            borderRadius: {
                type: ControlType.BorderRadius,
                defaultValue: "8px",
            },
            padding: { type: ControlType.Padding, defaultValue: "4px" },
            itemGap: { type: ControlType.Number, defaultValue: 2 },
            minWidth: { type: ControlType.String, defaultValue: "100%" },
            maxHeight: { type: ControlType.String, defaultValue: "300px" },
            shadow: {
                type: ControlType.BoxShadow,
                defaultValue: "0 4px 12px rgba(0,0,0,0.1)",
            },
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
            font: {
                type: ControlType.Font,
                controls: "extended",
                defaultFontType: "sans-serif",
                defaultValue: {
                    fontSize: "15px",
                    variant: "Medium",
                    letterSpacing: "-0.01em",
                    lineHeight: "1.3em",
                },
            },
            padding: { type: ControlType.Padding, defaultValue: "10px 16px" },
            checkboxGap: { type: ControlType.Number, defaultValue: 8 },
            borderRadius: {
                type: ControlType.BorderRadius,
                defaultValue: "4px",
            },
            background: { type: ControlType.Color, defaultValue: "#FFFFFF" },
            hoverBackground: {
                type: ControlType.Color,
                defaultValue: "#F5F5F5",
            },
            activeBackground: {
                type: ControlType.Color,
                defaultValue: "#F0F0F0",
            },
            activeHoverBackground: {
                type: ControlType.Color,
                defaultValue: "#E8E8E8",
            },
            color: { type: ControlType.Color, defaultValue: "#333333" },
            activeColor: { type: ControlType.Color, defaultValue: "#000000" },
        },
    },
    checkboxStyle: {
        type: ControlType.Object,
        title: "Checkbox Style",
        controls: {
            size: { type: ControlType.Number, defaultValue: 16 },
            borderRadius: { type: ControlType.Number, defaultValue: 4 },
            borderWidth: { type: ControlType.Number, defaultValue: 1 },
            borderColor: { type: ControlType.Color, defaultValue: "#CCCCCC" },
            background: { type: ControlType.Color, defaultValue: "#FFFFFF" },
            checkedBackground: {
                type: ControlType.Color,
                defaultValue: "#594FEE",
            },
            checkColor: { type: ControlType.Color, defaultValue: "#FFFFFF" },
        },
    },
    searchIconStyle: {
        type: ControlType.Object,
        title: "Search Icon",
        controls: {
            size: { type: ControlType.Number, defaultValue: 14 },
            color: { type: ControlType.Color, defaultValue: "#B3B3B3" },
            strokeWidth: { type: ControlType.Number, defaultValue: 2 },
        },
    },
})
