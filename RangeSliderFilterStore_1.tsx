import React, {
    useState,
    useEffect,
    useRef,
    useCallback,
    useMemo,
    startTransition,
} from "react"
import { addPropertyControls, ControlType } from "framer"
import { motion } from "framer-motion"
import { store, FilterState } from "./store.ts"

// --- CONFIG ---
const RESET_EVENT = "reset-broadcast-filters"
const UPDATE_EVENT = "broadcast-items-updated"
const REFRESH_EVENT = "broadcast-force-refresh"

// --- HOOK ---
function usePersistentState(key, initialValue, isEnabled) {
    const [state, setState] = useState(() => {
        if (typeof window === "undefined") return initialValue
        if (!isEnabled) return initialValue
        try {
            const item = sessionStorage.getItem(key)
            return item ? JSON.parse(item) : initialValue
        } catch (error) {
            return initialValue
        }
    })
    return [state, setState]
}

/**
 * @framerDisableUnlink
 * @framerIntrinsicWidth 250
 * @framerIntrinsicHeight 48
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
// Force Refresh
function RangeSliderFilter(props) {
    const {
        persistState = true,
        placeholder = "Prix",
        showHistogram = true,
        histogramColor = "#A5C0EE",
        showAverage = true,
        averageText = "Moyenne",
        applyButtonText = "Valider",
        applyButtonStyle = {},
        selectorStyle,
        activeStyle,
        iconStyle,
        transition,
        clearIconStyle,
        dropdownGap,
        dropdownStyle,
        track,
        knob,
        inputs,
        rangeDisplay,
    } = props

    // Clé pour le store
    const filterKey = `filter_slider_${(props.layerName || "").trim().toLowerCase().replace(/\s+/g, "_")}`

    // --- INITIAL DATA SYNC (Synchronous for Overlay Persistence) ---
    // On calcule les bornes immédiatement si les items sont déjà au store
    const initialBounds = useMemo(() => {
        const layerKey = (props.layerName || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_")
        let vals: number[] = []
        store.state.items.forEach((item) => {
            const rawVal = item[layerKey]
            if (rawVal) {
                const cleanStr = String(rawVal)
                    .replace(/[^0-9.,-]/g, "")
                    .replace(",", ".")
                const val = parseFloat(cleanStr)
                if (!isNaN(val)) vals.push(val)
            }
        })
        if (vals.length === 0) return { min: 0, max: 100 }
        return { min: Math.min(...vals), max: Math.max(...vals) }
    }, [props.layerName])

    // --- STATE ---

    const [isOpen, setIsOpen] = useState(false)
    const [isHovered, setIsHovered] = useState(false)
    const [dataMin, setDataMin] = useState(initialBounds.min)
    const [dataMax, setDataMax] = useState(initialBounds.max)

    const uniqueId = useRef(
        `range-${(props.layerName || "default").replace(/[^a-zA-Z0-9-_]/g, "").toLowerCase()}`
    )

    const [minVal, setMinVal] = useState(() => {
        const current = store.state.activeFilters.get(filterKey)
        return current ? current[0] : initialBounds.min
    })
    const [maxVal, setMaxVal] = useState(() => {
        const current = store.state.activeFilters.get(filterKey)
        return current ? current[1] : initialBounds.max
    })
    const [appliedMin, setAppliedMin] = useState(() => {
        const current = store.state.activeFilters.get(filterKey)
        return current ? current[0] : initialBounds.min
    })
    const [appliedMax, setAppliedMax] = useState(() => {
        const current = store.state.activeFilters.get(filterKey)
        return current ? current[1] : initialBounds.max
    })

    const [currency, setCurrency] = useState({ prefix: "", suffix: "" })
    const [minString, setMinString] = useState("0")
    const [maxString, setMaxString] = useState("100")

    const [histogramData, setHistogramData] = useState([])
    const [averageValue, setAverageValue] = useState(null)

    const trackRef = useRef(null)
    const isInitialized = useRef(true) // Changed to true
    const containerRef = useRef(null)

    // --- OPTIMISATION PERF ---
    const lastScannedItemsRef = useRef(null)

    const parseNumber = (str) => {
        if (!str) return 0
        const cleanStr = str.replace(/[^0-9.,-]/g, "").replace(",", ".")
        return parseFloat(cleanStr) || 0
    }

    const detectCurrencyFormat = (str) => {
        if (!str) return { prefix: "", suffix: "" }
        const match = str.match(/^([^0-9-]*)([\d.,\-\s]+)(.*)$/)
        if (match) {
            return { prefix: match[1].trim(), suffix: match[3].trim() }
        }
        return { prefix: "", suffix: "" }
    }

    // Track initial mount to prevent page reset on reload
    const isFirstRun = useRef(true)

    // --- STORE INTEGRATION ---
    useEffect(() => {
        const handleStoreUpdate = (state: FilterState) => {
            const layerKey = (props.layerName || "")
                .trim()
                .toLowerCase()
                .replace(/\s+/g, "_")

            // Optimization: check if items changed before heavy processing
            if (state.items === lastScannedItemsRef.current) {
                // Still sync filter state though
                const currentFilter = state.activeFilters.get(filterKey)
                if (!currentFilter) {
                    // Always reset to data bounds if filter no longer exists
                    setMinVal(dataMin)
                    setMaxVal(dataMax)
                    setAppliedMin(dataMin)
                    setAppliedMax(dataMax)
                }
                return
            }
            lastScannedItemsRef.current = state.items

            let values: number[] = []
            state.items.forEach((item) => {
                const rawVal = item[layerKey]
                if (rawVal) {
                    const cleanStr = String(rawVal)
                        .replace(/[^0-9.,-]/g, "")
                        .replace(",", ".")
                    const val = parseFloat(cleanStr)
                    if (!isNaN(val)) values.push(val)
                }
            })

            if (values.length > 0) {
                const foundMin = Math.min(...values)
                const foundMax = Math.max(...values)

                // Histogramme optimisé
                const range = foundMax - foundMin
                const bins = new Array(20).fill(0)
                if (range > 0) {
                    for (let j = 0; j < values.length; j++) {
                        const v = values[j]
                        const idx = Math.min(
                            Math.floor(((v - foundMin) / range) * 20),
                            19
                        )
                        bins[idx]++
                    }
                } else {
                    bins[0] = values.length
                }

                startTransition(() => {
                    setHistogramData(bins)
                    setAverageValue(
                        values.reduce((a, b) => a + b, 0) / values.length
                    )

                    if (foundMin !== dataMin || foundMax !== dataMax) {
                        setDataMin(foundMin)
                        setDataMax(foundMax)
                    }

                    // Sync initial/external filter state
                    const currentFilter = state.activeFilters.get(filterKey)
                    if (!currentFilter) {
                        setMinVal(foundMin)
                        setMaxVal(foundMax)
                        setAppliedMin(foundMin)
                        setAppliedMax(foundMax)
                    } else {
                        const [sMin, sMax] = currentFilter
                        setMinVal(sMin)
                        setMaxVal(sMax)
                        setAppliedMin(sMin)
                        setAppliedMax(sMax)
                    }
                })
            }
        }

        const unsubscribe = store.subscribe(handleStoreUpdate)
        return unsubscribe
    }, [filterKey, props.layerName, dataMin, dataMax])

    // 2. Sync applied filter to store
    useEffect(() => {
        if (isInitialized.current) {
            if (appliedMin !== dataMin || appliedMax !== dataMax) {
                store.setFilter(
                    filterKey,
                    [appliedMin, appliedMax],
                    isFirstRun.current
                )
            } else {
                store.removeFilter(filterKey, isFirstRun.current)
            }

            if (isFirstRun.current) {
                isFirstRun.current = false
            }
        }
    }, [appliedMin, appliedMax, filterKey, dataMin, dataMax])

    // --- APPLY FILTER ---
    const handleApply = () => {
        setAppliedMin(minVal)
        setAppliedMax(maxVal)
        setIsOpen(false)

        // Optimisation: Si range complet, on supprime le filtre pour perf
        if (minVal === dataMin && maxVal === dataMax) {
            store.removeFilter(filterKey)
            if (persistState) window.sessionStorage.removeItem(filterKey)
        } else {
            store.setFilter(filterKey, [minVal, maxVal])
            if (persistState)
                window.sessionStorage.setItem(
                    filterKey,
                    JSON.stringify([minVal, maxVal])
                )
        }
    }

    useEffect(() => {
        startTransition(() => {
            setMinString(minVal.toString())
            setMaxString(maxVal.toString())
        })
    }, [minVal, maxVal])

    // --- EFFECT: Handle Reset via Store (si besoin d'écouter le reset global pour UI locale) ---
    // Le store notifie via handleStoreUpdate, donc normalement le reset est géré là-bas (mise à jour des values)
    // On conserve juste l'update des strings inputs

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target)
            ) {
                startTransition(() => {
                    setMinVal(appliedMin)
                    setMaxVal(appliedMax)
                    setIsOpen(false)
                })
            }
        }
        if (isOpen) document.addEventListener("mousedown", handleClickOutside)
        return () =>
            document.removeEventListener("mousedown", handleClickOutside)
    }, [isOpen, appliedMin, appliedMax])

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target)
            ) {
                startTransition(() => {
                    setMinVal(appliedMin)
                    setMaxVal(appliedMax)
                    setIsOpen(false)
                })
            }
        }
        if (isOpen) document.addEventListener("mousedown", handleClickOutside)
        return () =>
            document.removeEventListener("mousedown", handleClickOutside)
    }, [isOpen, appliedMin, appliedMax])

    // --- HANDLERS UI ---
    const handleMinCommit = () => {
        let val = parseFloat(minString)
        if (isNaN(val)) val = dataMin
        val = Math.max(dataMin, Math.min(val, maxVal))
        setMinVal(val)
        setMinString(val.toString())
    }
    const handleMaxCommit = () => {
        let val = parseFloat(maxString)
        if (isNaN(val)) val = dataMax
        val = Math.min(dataMax, Math.max(val, minVal))
        setMaxVal(val)
        setMaxString(val.toString())
    }

    const getPercent = (value) => {
        if (dataMax === dataMin) return 0
        return Math.round(((value - dataMin) / (dataMax - dataMin)) * 100)
    }
    const getValueFromPercent = (percent) => {
        const val = dataMin + (percent / 100) * (dataMax - dataMin)
        return Math.round(val)
    }

    const handleTrackClick = (e) => {
        if (!trackRef.current) return
        const rect = trackRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const percent = Math.min(Math.max((x / rect.width) * 100, 0), 100)
        const value = getValueFromPercent(percent)
        const distMin = Math.abs(value - minVal)
        const distMax = Math.abs(value - maxVal)

        startTransition(() => {
            if (distMin < distMax) {
                const newVal = Math.min(value, maxVal - 1)
                setMinVal(Math.max(newVal, dataMin))
            } else {
                const newVal = Math.max(value, minVal + 1)
                setMaxVal(Math.min(newVal, dataMax))
            }
        })
    }

    const handleClearFilters = () => {
        store.removeFilter(filterKey)
    }

    // --- RENDU UI ---
    const minPercent = getPercent(minVal)
    const maxPercent = getPercent(maxVal)
    const maxBinHeight = Math.max(...histogramData, 1)

    const isActive = appliedMin !== dataMin || appliedMax !== dataMax

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
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                position: "relative",
                userSelect: "none",
            }}
        >
            {/* BARRE */}
            <div
                onClick={() => startTransition(() => setIsOpen(!isOpen))}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                style={{
                    width: "100%",
                    height: "100%",
                    // ICI LE PADDING EST APPLIQUÉ DYNAMIQUEMENT
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
                }}
            >
                <div style={{ marginRight: selectorStyle.iconGap, flex: 1 }}>
                    {isActive
                        ? `${placeholder}: ${appliedMin} – ${appliedMax}${inputs.showUnit ? ` ${inputs.unit || currency.suffix.trim() || ""}` : ""}`
                        : placeholder}
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
                                alignSelf: "center",
                                background:
                                    clearIconStyle.separatorColor || "#E0E0E0",
                                marginLeft: "-2px",
                                marginRight: "2px",
                            }}
                        />
                    )}
                    {selectorStyle.showArrow && (
                        <div
                            style={{
                                transform: isOpen
                                    ? "rotate(180deg)"
                                    : "rotate(0deg)",
                                transition: "transform 0.2s",
                            }}
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
                        </div>
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
                        right: 0,
                        minWidth: dropdownStyle.minWidth || "100%",
                        zIndex: 1000,
                        padding: dropdownStyle.padding,
                        backgroundColor: dropdownStyle.background,
                        border: `${dropdownStyle.border.borderWidth}px ${dropdownStyle.border.borderStyle} ${dropdownStyle.border.borderColor}`,
                        borderRadius: dropdownStyle.borderRadius,
                        boxShadow: dropdownStyle.shadow,
                    }}
                >
                    {showHistogram && (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "flex-end",
                                height: 60,
                                marginBottom: -track.height / 2,
                                paddingBottom: track.height + 4,
                                gap: 2,
                            }}
                        >
                            {histogramData.map((count, i) => {
                                const binStart = (i / 20) * 100
                                const binEnd = ((i + 1) / 20) * 100
                                const binCenter = (binStart + binEnd) / 2
                                const isIncluded =
                                    binCenter >= minPercent &&
                                    binCenter <= maxPercent
                                return (
                                    <div
                                        key={i}
                                        style={{
                                            flex: 1,
                                            backgroundColor: histogramColor,
                                            height: `${(count / maxBinHeight) * 100}%`,
                                            borderRadius: "2px 2px 0 0",
                                            opacity: isIncluded ? 1 : 0.4,
                                            transition: "opacity 0.2s",
                                        }}
                                    />
                                )
                            })}
                        </div>
                    )}
                    <div
                        ref={trackRef}
                        onClick={handleTrackClick}
                        style={{
                            position: "relative",
                            marginLeft: knob.size / 2,
                            marginRight: knob.size / 2,
                            height:
                                track.height +
                                Math.max(0, knob.size - track.height),
                            display: "flex",
                            alignItems: "center",
                            cursor: "pointer",
                            marginBottom: inputs.show ? inputs.gap : 0,
                            flexShrink: 0,
                            zIndex: 10,
                        }}
                    >
                        <div
                            style={{
                                position: "absolute",
                                left: 0,
                                right: 0,
                                height: track.height,
                                borderRadius: track.radius,
                                backgroundColor: track.color,
                                zIndex: 1,
                            }}
                        />
                        <div
                            style={{
                                position: "absolute",
                                left: `${minPercent}%`,
                                width: `${maxPercent - minPercent}%`,
                                height: track.height,
                                borderRadius: track.radius,
                                backgroundColor: track.activeColor,
                                zIndex: 2,
                                pointerEvents: "none",
                            }}
                        />
                        <input
                            type="range"
                            min={dataMin}
                            max={dataMax}
                            value={minVal}
                            onChange={(e) =>
                                startTransition(() =>
                                    setMinVal(
                                        Math.min(
                                            Number(e.target.value),
                                            maxVal - 1
                                        )
                                    )
                                )
                            }
                            style={{
                                position: "absolute",
                                width: `calc(100% + ${knob.size}px)`,
                                left: -knob.size / 2,
                                top: "50%",
                                transform: "translateY(-50%)",
                                opacity: 0,
                                zIndex: 4,
                                height: Math.max(knob.size * 1.5, 40),
                                margin: 0,
                                pointerEvents: "none",
                            }}
                        />
                        <input
                            type="range"
                            min={dataMin}
                            max={dataMax}
                            value={maxVal}
                            onChange={(e) =>
                                startTransition(() =>
                                    setMaxVal(
                                        Math.max(
                                            Number(e.target.value),
                                            minVal + 1
                                        )
                                    )
                                )
                            }
                            style={{
                                position: "absolute",
                                width: `calc(100% + ${knob.size}px)`,
                                left: -knob.size / 2,
                                top: "50%",
                                transform: "translateY(-50%)",
                                opacity: 0,
                                zIndex: 4,
                                height: Math.max(knob.size * 1.5, 40),
                                margin: 0,
                                pointerEvents: "none",
                            }}
                        />
                        {[minPercent, maxPercent].map((percent, i) => (
                            <div
                                key={i}
                                style={{
                                    position: "absolute",
                                    left: `${percent}%`,
                                    width: knob.size,
                                    height: knob.size,
                                    borderRadius: knob.radius || "50%",
                                    backgroundColor: knob.color,
                                    border: `${knob.borderWidth}px solid ${knob.borderColor}`,
                                    boxShadow: knob.shadow,
                                    transform: "translate(-50%, 0)",
                                    zIndex: 3,
                                    pointerEvents: "none",
                                    transition: "transform 0.1s",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            />
                        ))}
                    </div>
                    {inputs.show && (
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: inputs.itemGap,
                                width: "100%",
                                boxSizing: "border-box",
                                flexShrink: 0,
                            }}
                        >
                            <div
                                style={{
                                    flex: 1,
                                    border: `${inputs.borderWidth}px solid ${inputs.borderColor}`,
                                    backgroundColor: inputs.background,
                                    borderRadius: inputs.radius,
                                    padding: inputs.padding,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 4,
                                }}
                            >
                                {(inputs.showLabels ?? true) && (
                                    <label
                                        style={{ fontSize: 12, color: "#666" }}
                                    >
                                        {inputs.minLabel ?? "Min"}{" "}
                                        {(inputs.showUnit ?? true) &&
                                            `(${inputs.unit || currency.suffix.trim() || "EUR"})`}
                                    </label>
                                )}
                                <input
                                    type="text"
                                    value={minString}
                                    onChange={(e) =>
                                        setMinString(e.target.value)
                                    }
                                    onBlur={handleMinCommit}
                                    onKeyDown={(e) =>
                                        e.key === "Enter" && handleMinCommit()
                                    }
                                    style={{
                                        width: "100%",
                                        border: "none",
                                        background: "transparent",
                                        color: inputs.color,
                                        ...inputs.font,
                                        outline: "none",
                                        padding: 0,
                                        margin: 0,
                                    }}
                                />
                            </div>
                            <div
                                style={{
                                    flex: 1,
                                    border: `${inputs.borderWidth}px solid ${inputs.borderColor}`,
                                    backgroundColor: inputs.background,
                                    borderRadius: inputs.radius,
                                    padding: inputs.padding,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 4,
                                }}
                            >
                                {(inputs.showLabels ?? true) && (
                                    <label
                                        style={{ fontSize: 12, color: "#666" }}
                                    >
                                        {inputs.maxLabel ?? "Max"}{" "}
                                        {(inputs.showUnit ?? true) &&
                                            `(${inputs.unit || currency.suffix.trim() || "EUR"})`}
                                    </label>
                                )}
                                <input
                                    type="text"
                                    value={maxString}
                                    onChange={(e) =>
                                        setMaxString(e.target.value)
                                    }
                                    onBlur={handleMaxCommit}
                                    onKeyDown={(e) =>
                                        e.key === "Enter" && handleMaxCommit()
                                    }
                                    style={{
                                        width: "100%",
                                        border: "none",
                                        background: "transparent",
                                        color: inputs.color,
                                        ...inputs.font,
                                        outline: "none",
                                        padding: 0,
                                        margin: 0,
                                    }}
                                />
                            </div>
                        </div>
                    )}
                    {showAverage && averageValue !== null && (
                        <div
                            style={{
                                marginTop: 16,
                                fontSize: 14,
                                color: rangeDisplay.color,
                            }}
                        >
                            {averageText} {currency.prefix}
                            {averageValue.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })}
                            {currency.suffix}
                        </div>
                    )}
                    <div
                        onClick={handleApply}
                        style={{
                            marginTop: 16,
                            padding: "10px",
                            backgroundColor:
                                applyButtonStyle.backgroundColor || "#594FEE",
                            color: applyButtonStyle.color || "white",
                            borderRadius: applyButtonStyle.borderRadius || 6,
                            textAlign: "center",
                            cursor: "pointer",
                            fontWeight: 600,
                            fontSize: 14,
                            transition: "opacity 0.2s",
                            userSelect: "none",
                        }}
                        onMouseEnter={(e) =>
                            (e.currentTarget.style.opacity = "0.9")
                        }
                        onMouseLeave={(e) =>
                            (e.currentTarget.style.opacity = "1")
                        }
                    >
                        {applyButtonText}
                    </div>
                </motion.div>
            )}
            <style>{`input[type=range]::-webkit-slider-thumb { pointer-events: all; width: ${knob.size}px; height: ${knob.size}px; -webkit-appearance: none; background: transparent; cursor: pointer; } input[type=range]::-moz-range-thumb { pointer-events: all; width: ${knob.size}px; height: ${knob.size}px; border: none; background: transparent; cursor: pointer; }`}</style>
        </div>
    )
}

addPropertyControls(RangeSliderFilter, {
    persistState: {
        type: ControlType.Boolean,
        title: "Persist State",
        defaultValue: true,
    },
    placeholder: {
        type: ControlType.String,
        title: "Placeholder",
        defaultValue: "Prix",
    },
    layerName: {
        type: ControlType.String,
        title: "Layer Name",
        defaultValue: "Price",
    },
    applyButtonText: {
        type: ControlType.String,
        title: "Button Text",
        defaultValue: "Valider",
    },
    applyButtonStyle: {
        type: ControlType.Object,
        title: "Button Style",
        controls: {
            backgroundColor: {
                type: ControlType.Color,
                defaultValue: "#594FEE",
            },
            color: { type: ControlType.Color, defaultValue: "#FFFFFF" },
            borderRadius: { type: ControlType.Number, defaultValue: 6 },
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
            // PADDING PAR DÉFAUT MODIFIÉ ICI
            padding: { type: ControlType.Padding, defaultValue: "0px 16px" },
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
            padding: { type: ControlType.Padding, defaultValue: "16px" },
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
                    borderColor: "#E5E5E5",
                },
            },
        },
    },
    showHistogram: {
        type: ControlType.Boolean,
        title: "Histogram",
        defaultValue: true,
    },
    histogramColor: {
        type: ControlType.Color,
        title: "Bar Color",
        defaultValue: "#635651",
        hidden: (props) => !props.showHistogram,
    },
    showAverage: {
        type: ControlType.Boolean,
        title: "Show Avg",
        defaultValue: true,
    },
    averageText: {
        type: ControlType.String,
        title: "Avg Text",
        defaultValue: "Le prix moyen est de",
        hidden: (props) => !props.showAverage,
    },
    track: {
        type: ControlType.Object,
        title: "Track",
        controls: {
            height: {
                type: ControlType.Number,
                title: "Height",
                defaultValue: 4,
                min: 1,
                max: 20,
            },
            radius: {
                type: ControlType.Number,
                title: "Radius",
                defaultValue: 2,
                min: 0,
                max: 20,
            },
            color: {
                type: ControlType.Color,
                title: "Color",
                defaultValue: "#E5E5E5",
            },
            activeColor: {
                type: ControlType.Color,
                title: "Active Color",
                defaultValue: "#635651",
            },
        },
    },
    knob: {
        type: ControlType.Object,
        title: "Knob",
        controls: {
            size: {
                type: ControlType.Number,
                title: "Size",
                defaultValue: 24,
                min: 10,
                max: 50,
            },
            radius: {
                type: ControlType.Number,
                title: "Radius",
                defaultValue: 50,
                min: 0,
                max: 50,
            },
            color: {
                type: ControlType.Color,
                title: "Color",
                defaultValue: "#FFFFFF",
            },
            borderWidth: {
                type: ControlType.Number,
                title: "Border Width",
                defaultValue: 4,
                min: 0,
                max: 10,
            },
            borderColor: {
                type: ControlType.Color,
                title: "Border Color",
                defaultValue: "#635651",
            },
            shadow: {
                type: ControlType.BoxShadow,
                title: "Shadow",
                defaultValue: "0px 2px 4px rgba(0,0,0,0.1)",
            },
        },
    },
    rangeDisplay: {
        type: ControlType.Object,
        title: "Range Display",
        controls: {
            gap: {
                type: ControlType.Number,
                title: "Gap",
                defaultValue: 12,
                min: 0,
                max: 50,
            },
            font: {
                type: ControlType.Font,
                title: "Font",
                controls: "extended",
                defaultFontType: "sans-serif",
                defaultValue: { fontSize: 15, variant: "Semibold" },
            },
            color: {
                type: ControlType.Color,
                title: "Color",
                defaultValue: "#333333",
            },
        },
    },
    inputs: {
        type: ControlType.Object,
        title: "Inputs",
        controls: {
            show: {
                type: ControlType.Boolean,
                title: "Show",
                defaultValue: true,
            },
            showLabels: {
                type: ControlType.Boolean,
                title: "Show Labels",
                defaultValue: true,
            },
            minLabel: {
                type: ControlType.String,
                title: "Min Label",
                defaultValue: "Min",
            },
            maxLabel: {
                type: ControlType.String,
                title: "Max Label",
                defaultValue: "Max",
            },
            showUnit: {
                type: ControlType.Boolean,
                title: "Show Unit",
                defaultValue: true,
            },
            unit: {
                type: ControlType.String,
                title: "Unit",
                defaultValue: "",
                placeholder: "Auto",
            },
            gap: {
                type: ControlType.Number,
                title: "Top Gap",
                defaultValue: 16,
                min: 0,
                max: 50,
            },
            itemGap: {
                type: ControlType.Number,
                title: "Center Gap",
                defaultValue: 16,
                min: 0,
                max: 50,
            },
            background: {
                type: ControlType.Color,
                title: "Background",
                defaultValue: "#FFFFFF",
            },
            color: {
                type: ControlType.Color,
                title: "Text Color",
                defaultValue: "#333333",
            },
            borderColor: {
                type: ControlType.Color,
                title: "Border",
                defaultValue: "#666666",
            },
            borderWidth: {
                type: ControlType.Number,
                title: "Width",
                defaultValue: 1,
                min: 0,
                max: 5,
            },
            radius: {
                type: ControlType.Number,
                title: "Radius",
                defaultValue: 8,
                min: 0,
                max: 20,
            },
            padding: {
                type: ControlType.String,
                title: "Padding",
                defaultValue: "8px 12px",
            },
            font: {
                type: ControlType.Font,
                title: "Font",
                controls: "extended",
                defaultFontType: "sans-serif",
                defaultValue: { fontSize: 16, variant: "Regular" },
            },
        },
    },
})

export default RangeSliderFilter
