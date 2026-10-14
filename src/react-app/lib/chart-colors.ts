// Cores de gráfico em hex literal: html2canvas (export PDF) não resolve var() dentro de SVG.
// Manter em sincronia com --chart-* / --success / --danger do index.css.

export const CHART_COLORS = [
  "#526B94", "#478566", "#B85C63", "#A3853F", "#8A7BA8",
  "#49818F", "#AD6E52", "#5C7A46", "#A6708F", "#83888F",
];

export const SERIES_COLORS = {
  receitas: "#327B59", // --success
  receitasPendentes: "#9CCBB3",
  despesas: "#B32D31", // --danger
  despesasPendentes: "#E3A3A5",
  saldo: "#526B94",
} as const;

export const chartColor = (index: number): string => CHART_COLORS[index % CHART_COLORS.length];
