// SVG → PNG com @resvg/resvg-js (binário nativo). Carregado sob demanda e com try/catch: se a biblioteca ou as
// fontes faltarem no servidor, o assistente responde com texto em vez de derrubar o processo.
type ResvgCtor = new (svg: string, opts?: object) => { render(): { asPng(): Uint8Array } };

let resvg: Promise<ResvgCtor | null> | null = null;

const load = (): Promise<ResvgCtor | null> => {
  resvg ??= import("@resvg/resvg-js")
    .then((m) => m.Resvg as unknown as ResvgCtor)
    .catch((e) => {
      console.error("Gráficos desativados (resvg indisponível):", e instanceof Error ? e.message : e);
      return null;
    });
  return resvg;
};

/** PNG do SVG, ou null se o renderizador não está disponível ou falhou. */
export const svgToPng = async (svg: string): Promise<Buffer | null> => {
  const Resvg = await load();
  if (!Resvg) return null;
  try {
    const img = new Resvg(svg, {
      fitTo: { mode: "width", value: 1000 },
      font: { loadSystemFonts: true, defaultFontFamily: "DejaVu Sans" },
    });
    return Buffer.from(img.render().asPng());
  } catch (e) {
    console.error("Falha ao renderizar gráfico:", e instanceof Error ? e.message : e);
    return null;
  }
};
