type ClassValue = string | number | boolean | null | undefined | ClassValue[] | Record<string, boolean | null | undefined>;

export function cn(...inputs: ClassValue[]) {
  const classes: string[] = []

  for (const input of inputs) {
    if (!input) continue

    if (typeof input === "string") {
      classes.push(input)
    } else if (Array.isArray(input)) {
      classes.push(
        ...input.filter((value): value is string => typeof value === "string" && value.length > 0),
      )
    } else if (typeof input === "object") {
      for (const [key, value] of Object.entries(input)) {
        if (value) {
          classes.push(key)
        }
      }
    }
  }

  return classes.join(" ")
}