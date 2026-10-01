// Small collection helpers the core and plugins share.

/** Items grouped by key, in first-seen order of the keys; each group in input order. Linear: one push per item. */
export function groupBy<T, K>(items: Iterable<T>, key: (item: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>()
  for (const item of items) {
    const k = key(item)
    const group = out.get(k)
    if (group) group.push(item)
    else out.set(k, [item])
  }
  return out
}

const readOnly = (): never => {
  throw new TypeError("the registry is read-only once the project is loaded")
}

/** A Map that refuses every change once constructed. */
export class FrozenMap<K, V> extends Map<K, V> {
  #sealed = false
  constructor(entries?: Iterable<readonly [K, V]>) {
    super() // not super(entries): Map's constructor would call set() before #sealed exists
    for (const [k, v] of entries ?? []) super.set(k, v)
    this.#sealed = true
    Object.freeze(this)
  }
  override set(key: K, value: V): this {
    return this.#sealed ? readOnly() : super.set(key, value)
  }
  override delete(_key: K): boolean {
    return readOnly()
  }
  override clear(): void {
    readOnly()
  }
}

/** A Set that refuses every change once constructed. */
export class FrozenSet<T> extends Set<T> {
  #sealed = false
  constructor(values?: Iterable<T>) {
    super()
    for (const v of values ?? []) super.add(v)
    this.#sealed = true
    Object.freeze(this)
  }
  override add(value: T): this {
    return this.#sealed ? readOnly() : super.add(value)
  }
  override delete(_value: T): boolean {
    return readOnly()
  }
  override clear(): void {
    readOnly()
  }
}

/** Freeze a plain JSON-like value and everything it holds. */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const v of Object.values(value)) deepFreeze(v)
  }
  return value
}
