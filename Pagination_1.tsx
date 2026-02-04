import React, { useState, useEffect, useRef } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"
import { store, FilterState } from "./store.ts"
/**
 * @framerDisableUnlink
 * @framerIntrinsicWidth 250
 * @framerIntrinsicHeight 48
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
export default function BroadcastPagination(props) {
    const isCanvas = RenderTarget.current() === RenderTarget.canvas
    const lastScrollY = useRef(0)
    const [isLoading, setIsLoading] = useState(false)

    // --- STATE MANAGER ---
    const [currentPage, setCurrentPage] = useState(() => {
        if (isCanvas) return 1
        // Synchronous read to avoid layout shift
        if (props.persistPage && typeof window !== "undefined") {
            try {
                const saved = sessionStorage.getItem("broadcast_current_page")
                return saved ? parseInt(saved) : 1
            } catch (e) {
                return 1
            }
        }
        return 1
    })
    const [totalItems, setTotalItems] = useState(0)
    const [totalPages, setTotalPages] = useState(1)

    // --- STORE INTEGRATION ---
    useEffect(() => {
        if (isCanvas) return

        // Init store pagination config with current page
        store.setPagination({
            itemsPerPage: props.itemsPerPage,
            isEnabled: true,
            mode: props.mode as any,
            persistPage: props.persistPage,
            currentPage: currentPage, // Force store to sync with our restored state
        })

        const unsubscribe = store.subscribe((state) => {
            setCurrentPage(state.pagination.currentPage)
            setTotalItems(state.pagination.totalItems)

            const pages = Math.ceil(
                state.pagination.totalItems / props.itemsPerPage
            )
            setTotalPages(pages || 1)
        })

        return unsubscribe
    }, [isCanvas, props.itemsPerPage, props.mode, props.persistPage])

    // Auto scroll logic (using store state)
    useEffect(() => {
        if (
            !isCanvas &&
            props.mode === "autoScroll" &&
            typeof window !== "undefined"
        ) {
            const handleScroll = () => {
                const scrollY = window.scrollY
                const windowHeight = window.innerHeight
                const documentHeight = document.documentElement.scrollHeight

                if (
                    scrollY > lastScrollY.current &&
                    scrollY + windowHeight >=
                        documentHeight - props.scrollThreshold &&
                    currentPage < totalPages &&
                    !isLoading
                ) {
                    setIsLoading(true)
                    // Artificial delay for UX or real fetch if async
                    setTimeout(() => {
                        store.setPage(currentPage + 1)
                        setIsLoading(false)
                    }, 300)
                }
                lastScrollY.current = scrollY
            }
            window.addEventListener("scroll", handleScroll, { passive: true })
            return () => window.removeEventListener("scroll", handleScroll)
        }
    }, [
        isCanvas,
        props.mode,
        props.scrollThreshold,
        currentPage,
        totalPages,
        isLoading,
    ])

    // Legacy support removal - we no longer use window.updatePagination logic

    const handlePageClick = (page) => {
        if (page !== currentPage && page >= 1 && page <= totalPages) {
            store.setPage(page)

            if (props.scrollToTop && typeof window !== "undefined") {
                if (props.scrollAnchor) {
                    const el = document.getElementById(props.scrollAnchor)
                    if (el) el.scrollIntoView({ behavior: "smooth" })
                } else {
                    window.scrollTo({ top: 0, behavior: "smooth" })
                }
            }
        }
    }

    const getVisiblePages = () => {
        const pages = []
        const maxVisible = props.maxVisiblePages
        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) pages.push(i)
            return pages
        }
        pages.push(1)
        let start = Math.max(2, currentPage - 1)
        let end = Math.min(totalPages - 1, currentPage + 1)
        while (
            end - start + 1 < maxVisible - 2 &&
            (start > 2 || end < totalPages - 1)
        ) {
            if (start > 2 && end < totalPages - 1) {
                if (currentPage - start <= end - currentPage) start--
                else end++
            } else if (start > 2) start--
            else if (end < totalPages - 1) end++
        }
        if (start > 2) pages.push("...")
        for (let i = start; i <= end; i++) pages.push(i)
        if (end < totalPages - 1) pages.push("...")
        if (totalPages > 1) pages.push(totalPages)
        return pages
    }

    // --- RENDU CANVAS ---
    if (isCanvas) {
        return (
            <div
                style={{
                    display: "flex",
                    gap: props.gap,
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                }}
            >
                {[1, 2, 3, "..."].map((p, i) => (
                    <div
                        key={i}
                        style={{
                            padding: props.padding,
                            background: props.background,
                            borderRadius: props.borderRadius,
                            border: `${props.border.borderWidth}px ${props.border.borderStyle} ${props.border.borderColor}`,
                            color: props.color,
                            ...props.font,
                        }}
                    >
                        {p}
                    </div>
                ))}
            </div>
        )
    }

    // --- RENDU LIVE ---
    if (totalItems === 0) return null
    if (totalPages <= 1 && !props.showWhenSinglePage) return null

    const handleLoadMore = () => {
        if (!isLoading && currentPage < totalPages) {
            setIsLoading(true)
            // Artificial delay for UX
            setTimeout(() => {
                store.setPage(currentPage + 1)
                setIsLoading(false)
            }, 300)
        }
    }

    // MODE: LOAD MORE
    if (props.mode === "loadMore") {
        if (currentPage >= totalPages) return null
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                }}
            >
                <div
                    onClick={handleLoadMore}
                    style={{
                        padding: props.buttonPadding,
                        background: isLoading
                            ? props.buttonLoadingBackground
                            : props.buttonBackground,
                        color: props.buttonTextColor,
                        borderRadius: props.buttonBorderRadius,
                        cursor: isLoading ? "default" : "pointer",
                        ...props.buttonFont,
                        opacity: isLoading ? 0.7 : 1,
                        border: `${props.buttonBorder.borderWidth}px ${props.buttonBorder.borderStyle} ${props.buttonBorder.borderColor}`,
                        transition: "all 0.2s ease",
                    }}
                >
                    {isLoading ? props.buttonLoadingText : props.loadMoreText}
                </div>
            </div>
        )
    }

    // MODE: AUTO SCROLL
    if (props.mode === "autoScroll") {
        if (isLoading && currentPage < totalPages) {
            return (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "100%",
                        padding: "20px",
                        color: props.loadingTextColor,
                        ...props.loadingFont,
                    }}
                >
                    {props.autoScrollLoadingText}
                </div>
            )
        }
        return null
    }

    // MODE: PAGINATION CLASSIQUE
    const visiblePages = getVisiblePages()
    return (
        <div
            style={{
                display: "flex",
                gap: props.gap,
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
            }}
        >
            {visiblePages.map((page, index) => (
                <div
                    key={`${page}-${index}`}
                    onClick={() => page !== "..." && handlePageClick(page)}
                    style={{
                        padding: props.padding,
                        background:
                            page === currentPage
                                ? props.activeBackground
                                : page === "..."
                                  ? "transparent"
                                  : props.background,
                        color:
                            page === currentPage
                                ? props.activeColor
                                : props.color,
                        borderRadius: page === "..." ? 0 : props.borderRadius,
                        cursor: page === "..." ? "default" : "pointer",
                        ...props.font,
                        minWidth: props.minWidth,
                        textAlign: "center",
                        border:
                            page === "..."
                                ? "none"
                                : `${props.border.borderWidth}px ${props.border.borderStyle} ${props.border.borderColor}`,
                        userSelect: "none",
                        transition: "background 0.2s, color 0.2s",
                    }}
                >
                    {page}
                </div>
            ))}
        </div>
    )
}

// --- CONTROLS ---
addPropertyControls(BroadcastPagination, {
    persistPage: {
        type: ControlType.Boolean,
        title: "Persist Page",
        defaultValue: true,
    },
    mode: {
        type: ControlType.Enum,
        title: "Mode",
        options: ["pagination", "loadMore", "autoScroll"],
        defaultValue: "pagination",
    },
    itemsPerPage: {
        type: ControlType.Number,
        title: "Items Per Page",
        defaultValue: 12,
    },
    maxVisiblePages: {
        type: ControlType.Number,
        title: "Max Visible Pages",
        defaultValue: 5,
        hidden: (p) => p.mode !== "pagination",
    },
    showWhenSinglePage: {
        type: ControlType.Boolean,
        title: "Show When Single",
        defaultValue: false,
        hidden: (p) => p.mode !== "pagination",
    },
    scrollToTop: {
        type: ControlType.Boolean,
        title: "Scroll to Top",
        defaultValue: true,
        hidden: (p) => p.mode !== "pagination",
    },
    scrollAnchor: {
        type: ControlType.String,
        title: "Scroll Anchor",
        defaultValue: "",
        hidden(props) {
            return props.mode !== "pagination" || !props.scrollToTop
        },
    },
    gap: {
        type: ControlType.Number,
        title: "Gap",
        defaultValue: 8,
        hidden: (p) => p.mode !== "pagination",
    },
    padding: {
        type: ControlType.Padding,
        title: "Padding",
        defaultValue: "8px 12px",
        hidden: (p) => p.mode !== "pagination",
    },
    borderRadius: {
        type: ControlType.BorderRadius,
        title: "Radius",
        defaultValue: "4px",
        hidden: (p) => p.mode !== "pagination",
    },
    border: {
        type: ControlType.Border,
        title: "Border",
        defaultValue: {
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: "#E0E0E0",
        },
        hidden: (p) => p.mode !== "pagination",
    },
    minWidth: {
        type: ControlType.String,
        title: "Min Width",
        defaultValue: "32px",
        hidden: (p) => p.mode !== "pagination",
    },
    background: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#FFFFFF",
        hidden: (p) => p.mode !== "pagination",
    },
    activeBackground: {
        type: ControlType.Color,
        title: "Active Bg",
        defaultValue: "#594FEE",
        hidden: (p) => p.mode !== "pagination",
    },
    color: {
        type: ControlType.Color,
        title: "Color",
        defaultValue: "#333333",
        hidden: (p) => p.mode !== "pagination",
    },
    activeColor: {
        type: ControlType.Color,
        title: "Active Color",
        defaultValue: "#FFFFFF",
        hidden: (p) => p.mode !== "pagination",
    },
    font: {
        type: ControlType.Font,
        controls: "extended",
        title: "Font",
        hidden: (p) => p.mode !== "pagination",
    },
    // Styles Load More
    loadMoreText: {
        type: ControlType.String,
        title: "Load More Text",
        defaultValue: "Load More",
        hidden: (p) => p.mode !== "loadMore",
    },
    buttonLoadingText: {
        type: ControlType.String,
        title: "Loading Text",
        defaultValue: "Loading...",
        hidden: (p) => p.mode !== "loadMore",
    },
    buttonPadding: {
        type: ControlType.Padding,
        title: "Button Padding",
        defaultValue: "12px 24px",
        hidden: (p) => p.mode !== "loadMore",
    },
    buttonBackground: {
        type: ControlType.Color,
        title: "Button Background",
        defaultValue: "#594FEE",
        hidden: (p) => p.mode !== "loadMore",
    },
    buttonLoadingBackground: {
        type: ControlType.Color,
        title: "Loading Background",
        defaultValue: "#999999",
        hidden: (p) => p.mode !== "loadMore",
    },
    buttonTextColor: {
        type: ControlType.Color,
        title: "Button Color",
        defaultValue: "#FFFFFF",
        hidden: (p) => p.mode !== "loadMore",
    },
    buttonBorderRadius: {
        type: ControlType.BorderRadius,
        title: "Button Radius",
        defaultValue: "6px",
        hidden: (p) => p.mode !== "loadMore",
    },
    buttonBorder: {
        type: ControlType.Border,
        title: "Button Border",
        defaultValue: {
            borderWidth: 0,
            borderStyle: "solid",
            borderColor: "transparent",
        },
        hidden: (p) => p.mode !== "loadMore",
    },
    buttonFont: {
        type: ControlType.Font,
        controls: "extended",
        title: "Button Font",
        hidden: (p) => p.mode !== "loadMore",
    },
    // Styles Auto Scroll
    autoScrollLoadingText: {
        type: ControlType.String,
        title: "Loading Text",
        defaultValue: "Loading more items...",
        hidden: (p) => p.mode !== "autoScroll",
    },
    loadingTextColor: {
        type: ControlType.Color,
        title: "Loading Color",
        defaultValue: "#666666",
        hidden: (p) => p.mode !== "autoScroll",
    },
    scrollThreshold: {
        type: ControlType.Number,
        title: "Scroll Threshold",
        defaultValue: 200,
        hidden: (p) => p.mode !== "autoScroll",
    },
    loadingFont: {
        type: ControlType.Font,
        controls: "extended",
        title: "Loading Font",
        hidden: (p) => p.mode !== "autoScroll",
    },
})
