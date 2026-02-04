import { Override } from "framer"
import { ComponentType } from "react"
import { store } from "./store.ts"

export function ResetAllAction(Component): ComponentType {
    return (props) => {
        return (
            <Component
                {...props}
                style={{ ...props.style, cursor: "pointer" }}
                whileTap={{ scale: 0.95 }}
                onTap={(event) => {
                    if (event) {
                        event.preventDefault()
                        event.stopPropagation()
                    }
                    store.resetFilters()
                }}
            />
        )
    }
}
