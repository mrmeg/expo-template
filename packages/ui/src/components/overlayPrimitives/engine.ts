/**
 * Every web overlay engine, as one module, reached through the one `import()` in
 * `lazyPart.tsx`. Radix, floating-ui and react-remove-scroll are shared between
 * these primitives, so separate `import()`s would leave them reachable from several
 * chunks and Metro would hoist them into `__common`, which every route downloads.
 *
 * Nothing but `lazyPart.tsx` may import this file. Native never does.
 */
export * as alertDialog from "@rn-primitives/alert-dialog";
export * as dialog from "@rn-primitives/dialog";
export * as dropdownMenu from "@rn-primitives/dropdown-menu";
export * as popover from "@rn-primitives/popover";
export * as select from "@rn-primitives/select";
export * as tooltip from "@rn-primitives/tooltip";
