import { useEffect, useMemo, useRef, useState } from 'react'

import { useDebounceCallback } from './useDebounceCallback'

export function useDebounceValue(
    initialValue,
    delay,
    options,
) {
    const eq = useMemo(
        () => options?.equalityFn ?? ((left, right) => left === right),
        [options?.equalityFn]
    )
    const unwrappedInitialValue =
        initialValue instanceof Function ? initialValue() : initialValue
    const [debouncedValue, setDebouncedValue] = useState(unwrappedInitialValue)
    const previousValueRef = useRef(unwrappedInitialValue)

    const updateDebouncedValue = useDebounceCallback(
        setDebouncedValue,
        delay,
        options,
    )

    // Update the debounced value if the initial value changes
    useEffect(() => {
        if (!eq(previousValueRef.current, unwrappedInitialValue)) {
            updateDebouncedValue(unwrappedInitialValue)
            previousValueRef.current = unwrappedInitialValue
        }
    }, [unwrappedInitialValue, updateDebouncedValue, eq])

    return [debouncedValue, updateDebouncedValue]
}