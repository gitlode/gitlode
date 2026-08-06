declare const brand: unique symbol;

export type Brand<T, Name extends PropertyKey> = T & {
  readonly [brand]: Name;
};
