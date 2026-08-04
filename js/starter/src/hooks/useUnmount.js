// Import Dependencies
import { useEffect, useRef } from 'react'

// ----------------------------------------------------------------------

export function useUnmount(func) {
    const funcRef = useRef(func)

    useEffect(() => {
        funcRef.current = func
    })

    useEffect(
        () => () => {
            funcRef.current()
        },
        [],
    )
}
