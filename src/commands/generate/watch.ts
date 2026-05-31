import { watch as fsWatch, existsSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

/**
 * Watch a model input for changes and invoke `onChange` (debounced) on each edit.
 *
 * The set of files the loader reads is flat — either a single YAML file, or the
 * `*.yaml` files directly inside a directory (the `objects/` subdir when present,
 * else the directory itself). So a non-recursive watch on that one directory
 * matches the loader's scope exactly and stays portable across platforms.
 *
 * Returns a function that stops watching.
 */
export function watchModel(inputPath: string, onChange: () => void): () => void {
  const resolved = resolve(inputPath);
  const isDir = statSync(resolved).isDirectory();

  let watchDir: string;
  let fileFilter: string | undefined;
  if (isDir) {
    const objectsSub = join(resolved, "objects");
    watchDir = existsSync(objectsSub) ? objectsSub : resolved;
  } else {
    watchDir = dirname(resolved);
    fileFilter = basename(resolved);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onChange, 120);
  };

  const watcher = fsWatch(watchDir, (_event, filename) => {
    if (filename) {
      const name = basename(filename.toString());
      if (fileFilter) {
        if (name !== fileFilter) return;
      } else if (!name.endsWith(".yaml") && !name.endsWith(".yml")) {
        return;
      }
    }
    debounced();
  });

  return () => {
    if (timer) clearTimeout(timer);
    watcher.close();
  };
}
