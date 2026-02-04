import { Override, RenderTarget } from "framer"
import { useEffect, useId, useRef } from "react"
import { store } from "./store.ts"

/**
 * GhostItem Override
 *
 * Ce code transforme votre carte CMS en "Fantôme".
 * Il envoie les données au Store et cache l'élément visuellement.
 */

interface GhostItemProps {
    id?: string
    title?: string
    price?: string
    category?: string
    image?: string
    // Ajoutez d'autres champs si nécessaire
    [key: string]: any
}

export function GhostItem(props: GhostItemProps): Override {
    const isCanvas = RenderTarget.current() === RenderTarget.canvas
    const uniqueId = useId()
    const registeredRef = useRef(false)
    // On garde une référence stable aux props pour éviter les boucles
    const propsRef = useRef<GhostItemProps>(props)
    propsRef.current = props

    useEffect(() => {
        if (isCanvas) return

        // 1. Identification unique de l'item
        // On utilise l'ID du CMS s'il existe, sinon on en génère un
        const itemId = props.id || props.slug || uniqueId

        // 2. Préparation des données
        const excludedKeys = new Set([
            "children",
            "style",
            "className",
            "__fromCodeComponentNode",
        ])

        const itemData: Record<string, any> = {
            _id: itemId,
            _index: props._index ?? 0,
        }

        // On capture toutes les variables passées au composant
        Object.entries(propsRef.current).forEach(([key, value]) => {
            if (!excludedKeys.has(key) && value !== undefined) {
                const normalizedKey = key
                    .trim()
                    .toLowerCase()
                    .replace(/\s+/g, "_")
                itemData[normalizedKey] = value
            }
        })

        // 3. Envoi au Store
        store.registerGhostItem(itemData)
        registeredRef.current = true

        // 4. Nettoyage si le composant est supprimé
        return () => {
            if (registeredRef.current) {
                store.unregisterGhostItem(itemId)
                registeredRef.current = false
            }
        }
    }, []) // Exécution unique au montage

    // On rend l'élément invisible (display: none)
    // Il est présent dans le code pour le SEO, mais caché visuellement
    return {
        style: {
            display: "none",
            visibility: "hidden",
            position: "absolute",
            pointerEvents: "none",
        },
        "data-ghost-item": "true",
        "data-ghost-id": props.id || props.slug || uniqueId,
    }
}
