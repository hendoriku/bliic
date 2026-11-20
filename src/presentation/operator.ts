/** "AXIS" -> "Axis"; nama yang sudah campuran huruf ("by.U", "Indosat") dan singkatan pendek ("XL") dibiarkan. */
export const niceOperator = (o: string): string =>
  o.length > 3 && o === o.toUpperCase() ? o[0] + o.slice(1).toLowerCase() : o;
