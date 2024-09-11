const glob = import.meta.glob(
  ["src/assets/images/tokens/*.svg", "src/assets/images/tokens/*.png"],
  {
    eager: true,
    as: "url"
  }
);

export const images: Record<string, string> = {};

for (const key of Object.keys(glob)) {
  const parts = key.split("/");
  const filename = parts[parts.length - 1];
  const symbol = filename.replace(/\.(svg|png)$/, "");
  images[symbol] = glob[key];
}
