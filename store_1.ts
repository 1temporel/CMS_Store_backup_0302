/**
 * @framerIntrinsicHeight 0
 * @framerIntrinsicWidth 0
 */

// Types définis pour plus de clarté
export type FilterType = "multi" | "range"

export interface FilterState {
    activeFilters: Map<string, any> // key -> value
    searchQuery: string
    sortConfig: {
        field: string | null
        direction: "asc" | "desc"
        type: "string" | "number" | "date"
    }
    items: any[] // Stockage des métadonnées des cards
    filteredItems: any[]
    pagination: {
        currentPage: number
        itemsPerPage: number
        totalItems: number
        isEnabled: boolean
        mode: "pagination" | "loadMore" | "autoScroll"
        persistPage: boolean
    }
}

type Listener = (state: FilterState) => void

/**
 * FilterStore
 * Un store centralisé (Singleton) pour gérer l'état des filtres et la pagination.
 * Utilise le pattern Observer pour notifier les composants (ActiveTags, Broadcaster, etc.).
 */
class FilterStore {
    public state: FilterState = {
        activeFilters: new Map(),
        searchQuery: "",
        sortConfig: { field: null, direction: "asc", type: "string" },
        items: [],
        filteredItems: [],
        pagination: {
            currentPage: 1,
            itemsPerPage: 12,
            totalItems: 0,
            isEnabled: true,
            mode: "pagination",
            persistPage: false,
        },
    }

    private initialized = false
    private listeners: Set<Listener> = new Set()

    constructor() {
        // Constructor is now empty to avoid early TBT impact
    }

    private lazyInit() {
        if (this.initialized || typeof window === "undefined") return
        this.initialized = true

        try {
            // Restore Pagination
            const savedPage = sessionStorage.getItem("broadcast_current_page")
            if (savedPage) {
                const page = parseInt(savedPage)
                if (!isNaN(page) && page > 0) {
                    this.state.pagination.currentPage = page
                }
            }

            // Restore Filters
            const savedFilters = sessionStorage.getItem(
                "broadcast_active_filters"
            )
            if (savedFilters) {
                const parsed = JSON.parse(savedFilters)
                this.state.activeFilters = new Map(Object.entries(parsed))
            }

            // Restore Search
            const savedSearch = sessionStorage.getItem("broadcast_search_query")
            if (savedSearch) {
                this.state.searchQuery = savedSearch
            }

            // Restore Sort
            const savedSort = sessionStorage.getItem("broadcast_sort_config")
            if (savedSort) {
                this.state.sortConfig = JSON.parse(savedSort)
            }
        } catch (e) {
            console.error("Error restoring store state:", e)
        }

        // Global Reset Event Support
        window.addEventListener("reset-broadcast-filters", () =>
            this.resetFilters()
        )
        ;(window as any).resetFilters = () => this.resetFilters()
    }

    // --- SUBSCRIPTION ---

    subscribe(listener: Listener): () => void {
        this.lazyInit()
        this.listeners.add(listener)
        // Notifier immédiatement le nouvel abonné avec l'état actuel
        listener({ ...this.state })
        return () => {
            this.listeners.delete(listener)
        }
    }

    private isBatching = false
    private pendingNotify = false

    public batch(fn: () => void) {
        this.isBatching = true
        try {
            fn()
        } finally {
            this.isBatching = false
            if (this.pendingNotify) {
                this.pendingNotify = false
                this.notify()
            }
        }
    }

    private notify() {
        if (this.isBatching) {
            this.pendingNotify = true
            return
        }

        // Clone state to prevent mutations and ensure fresh references for React
        const snapshot = {
            ...this.state,
            activeFilters: new Map(this.state.activeFilters),
            pagination: { ...this.state.pagination },
            sortConfig: { ...this.state.sortConfig },
            items: this.state.items,
            filteredItems: [...this.state.filteredItems],
        }

        // Persist state before notifying
        if (typeof window !== "undefined") {
            try {
                // Save Filters
                const filtersObj = Object.fromEntries(this.state.activeFilters)
                sessionStorage.setItem(
                    "broadcast_active_filters",
                    JSON.stringify(filtersObj)
                )

                // Save Search
                sessionStorage.setItem(
                    "broadcast_search_query",
                    this.state.searchQuery
                )

                // Save Sort
                sessionStorage.setItem(
                    "broadcast_sort_config",
                    JSON.stringify(this.state.sortConfig)
                )

                // Save pagination page
                if (this.state.pagination.persistPage) {
                    sessionStorage.setItem(
                        "broadcast_current_page",
                        String(this.state.pagination.currentPage)
                    )
                }
            } catch (e) {}
        }

        this.listeners.forEach((listener) => listener(snapshot))
    }

    // --- ACTIONS ---

    setItems(items: any[]) {
        // Optimization: Pre-process items for faster searching and filtering
        const processedItems = items.map((item) => {
            if (item._processed) return item

            // Pre-calculate searchable text
            const searchableText = Object.entries(item)
                .filter(([k, v]) => !k.startsWith("_") && typeof v === "string")
                .map(([_, v]) => this.normalizeText(v as string))
                .join(" ")

            return {
                ...item,
                _processed: true,
                _searchIndex: searchableText,
                // Pre-split comma values for multi-filters
                _multiIndex: Object.entries(item).reduce(
                    (acc, [k, v]) => {
                        if (typeof v === "string" && !k.startsWith("_")) {
                            acc[k] = v
                                .toLowerCase()
                                .split(",")
                                .map((s) => s.trim())
                                .filter((s) => s)
                        }
                        return acc
                    },
                    {} as Record<string, string[]>
                ),
            }
        })

        if (
            processedItems.length === this.state.items.length &&
            processedItems.every(
                (val, index) => val === this.state.items[index]
            )
        ) {
            return
        }
        this.state.items = processedItems
        this.applyFilters()
    }

    setFilter(key: string, value: any, preventPageReset = false) {
        if (
            value === null ||
            value === undefined ||
            (Array.isArray(value) && value.length === 0)
        ) {
            this.state.activeFilters.delete(key)
        } else {
            this.state.activeFilters.set(key, value)
        }
        if (!preventPageReset) {
            this.state.pagination.currentPage = 1
            this.updateStoragePage(1)
        }
        this.applyFilters()
    }

    removeFilter(key: string, preventPageReset = false) {
        this.state.activeFilters.delete(key)
        if (!preventPageReset) {
            this.state.pagination.currentPage = 1
            this.updateStoragePage(1)
        }
        this.applyFilters()
    }

    setSearch(query: string, preventPageReset = false) {
        this.state.searchQuery = query
        if (!preventPageReset) {
            this.state.pagination.currentPage = 1
            this.updateStoragePage(1)
        }
        this.applyFilters()
    }

    setSort(
        field: string | null,
        direction: "asc" | "desc",
        type: "string" | "number" | "date" = "string"
    ) {
        this.state.sortConfig = { field, direction, type }
        this.state.pagination.currentPage = 1
        this.updateStoragePage(1)
        this.applyFilters()
    }

    resetFilters() {
        this.state.activeFilters.clear()
        this.state.searchQuery = ""
        this.state.sortConfig = {
            field: null,
            direction: "asc",
            type: "string",
        }
        this.state.pagination.currentPage = 1
        this.updateStoragePage(1)
        this.applyFilters()

        if (typeof window !== "undefined") {
            try {
                sessionStorage.removeItem("broadcast_active_filters")
                sessionStorage.removeItem("broadcast_search_query")
                sessionStorage.removeItem("broadcast_sort_config")
                sessionStorage.removeItem("broadcast_current_page")
            } catch (e) {}
        }
    }

    setPagination(config: Partial<typeof this.state.pagination>) {
        this.state.pagination = { ...this.state.pagination, ...config }
        if (config.currentPage && this.state.pagination.persistPage) {
            this.updateStoragePage(config.currentPage)
        }
        this.notify()
    }

    setPage(page: number) {
        this.state.pagination.currentPage = page
        if (this.state.pagination.persistPage) {
            this.updateStoragePage(page)
        }
        this.notify()
    }

    private updateStoragePage(page: number) {
        if (typeof window !== "undefined") {
            try {
                sessionStorage.setItem("broadcast_current_page", String(page))
            } catch (e) {}
        }
    }

    /**
     * Cœur optimisé : applique les filtres, la recherche et le tri.
     */
    private applyFilters() {
        const { items, activeFilters, searchQuery, sortConfig } = this.state

        // 1. Optimization: Pre-calculate filter keys and logic to avoid regex/strings in loop
        const filters = Array.from(activeFilters.entries()).map(
            ([key, value]) => ({
                key,
                value,
                isMulti: key.startsWith("filter_multi_"),
                isSlider: key.startsWith("filter_slider_"),
                layerName: key.replace(/^filter_(multi|slider)_/, ""),
            })
        )

        const hasSearch = searchQuery.length > 0
        const normalizedQuery = hasSearch ? this.normalizeText(searchQuery) : ""
        const searchTerms = hasSearch
            ? normalizedQuery.split(" ").filter((t) => t)
            : []

        // 2. Combined filter + search pass (one single loop)
        let result = items.filter((item) => {
            // Apply all active filters
            for (const filter of filters) {
                const itemValue = item[filter.layerName]
                if (filter.isMulti) {
                    if (
                        !this.checkMultiMatch(
                            filter.value,
                            item._multiIndex[filter.layerName]
                        )
                    )
                        return false
                } else if (filter.isSlider) {
                    if (!this.checkSliderMatch(filter.value, itemValue))
                        return false
                }
            }

            // Apply search
            if (hasSearch) {
                const index = item._searchIndex || ""
                if (!searchTerms.every((term) => index.includes(term)))
                    return false
            }

            return true
        })

        // 3. Sort (last, on filtered items only)
        if (sortConfig.field) {
            result.sort((a, b) => {
                const valA = a[sortConfig.field!]
                const valB = b[sortConfig.field!]
                return this.compareValues(
                    valA,
                    valB,
                    sortConfig.type,
                    sortConfig.direction
                )
            })
        } else {
            result.sort((a, b) => (a._index || 0) - (b._index || 0))
        }

        this.state.filteredItems = result
        this.state.pagination.totalItems = result.length
        this.notify()
    }

    private normalizeText(text: string): string {
        return text
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
    }

    private checkMultiMatch(
        filterValues: string[],
        itemValues: string[]
    ): boolean {
        if (!filterValues || filterValues.length === 0) return true
        if (!itemValues) return false

        // Check if ANY of the selected filter options is present in item
        for (const opt of filterValues) {
            const optLower = opt.toLowerCase()
            if (itemValues.includes(optLower)) return true
            // Support partial matches for safety
            if (itemValues.some((itemOpt) => itemOpt.includes(optLower)))
                return true
        }
        return false
    }

    private checkSliderMatch(
        filterRange: [number, number],
        itemValue: any
    ): boolean {
        const cleanStr = String(itemValue).replace(/[^0-9.-]/g, "")
        const val = parseFloat(cleanStr)
        if (isNaN(val)) return false
        return val >= filterRange[0] && val <= filterRange[1]
    }

    private compareValues(
        a: any,
        b: any,
        type: string,
        direction: "asc" | "desc"
    ): number {
        if (a === undefined || a === null) return 1
        if (b === undefined || b === null) return -1

        let res = 0
        if (type === "number") {
            const numA =
                typeof a === "number"
                    ? a
                    : parseFloat(String(a).replace(/[^0-9.-]/g, "")) || 0
            const numB =
                typeof b === "number"
                    ? b
                    : parseFloat(String(b).replace(/[^0-9.-]/g, "")) || 0
            res = numA - numB
        } else if (type === "date") {
            const dateA = new Date(a).getTime() || 0
            const dateB = new Date(b).getTime() || 0
            res = dateA - dateB
        } else {
            res = String(a).localeCompare(String(b))
        }

        return direction === "asc" ? res : -res
    }
}

const GLOBAL_STORE_KEY = "__FRAMER_FILTER_STORE_INSTANCE__"
if (typeof window !== "undefined" && !window[GLOBAL_STORE_KEY]) {
    window[GLOBAL_STORE_KEY] = new FilterStore()
}

export const store = (
    typeof window !== "undefined" ? window[GLOBAL_STORE_KEY] : new FilterStore()
) as FilterStore
