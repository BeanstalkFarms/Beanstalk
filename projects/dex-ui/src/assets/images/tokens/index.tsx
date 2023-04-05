const glob = import.meta.glob("src/assets/images/tokens/*.svg", {
  eager: true,
  as: "url"
  // import: "default"
});

export const images: Record<string, string> = {};

for (const key of Object.keys(glob)) {
  let symbol = key.replace("/src/assets/images/tokens/", "").replace(".svg", "");
  images[symbol] = glob[key];
}
