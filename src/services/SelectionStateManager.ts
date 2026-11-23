import * as fs from "fs";
import * as path from "path";

export interface SelectionStateData {
  version: number;
  updatedAt: string;
  profile: string;
  files: Record<string, boolean>; // relative path -> isChecked
}

export interface ToggleBatchItem {
  relPath: string;
  defaultIncluded: boolean;
}

export class SelectionStateManager {
  private readonly STATE_DIR = ".smartexport";
  private readonly DEFAULT_STATE_FILE = "selection-state.json";

  public getStateFilePath(
    rootPath: string,
    profileName: string = "default",
  ): string {
    const safeProfile = profileName.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const filename =
      safeProfile === "default"
        ? this.DEFAULT_STATE_FILE
        : `selection-state-${safeProfile}.json`;
    return path.join(rootPath, this.STATE_DIR, filename);
  }

  public toRelativePath(rootPath: string, absFilePath: string): string {
    return path
      .relative(path.resolve(rootPath), path.resolve(absFilePath))
      .replace(/\\/g, "/");
  }

  public findNearestStateDirRoot(
    startPath: string,
    boundaryRoot?: string,
  ): string | null {
    let cur = path.resolve(startPath);
    try {
      if (fs.existsSync(cur) && fs.statSync(cur).isFile()) {
        cur = path.dirname(cur);
      }
    } catch {
      cur = path.dirname(cur);
    }

    const resolvedBoundary = boundaryRoot ? path.resolve(boundaryRoot) : null;

    while (true) {
      const candidate = path.join(cur, this.STATE_DIR);
      if (fs.existsSync(candidate)) {
        try {
          if (fs.statSync(candidate).isDirectory()) {
            return cur;
          }
        } catch {
          // ignore stat errors
        }
      }
      if (resolvedBoundary && cur === resolvedBoundary) {
        return null;
      }
      const parent = path.dirname(cur);
      if (parent === cur) {
        return null;
      }
      cur = parent;
    }
  }

  public async saveSelection(
    rootPath: string,
    selectionMap: Record<string, boolean>,
    profileName: string = "default",
  ): Promise<string> {
    const stateDir = path.join(rootPath, this.STATE_DIR);
    if (!fs.existsSync(stateDir)) {
      await fs.promises.mkdir(stateDir, { recursive: true });
    }

    const stateFile = this.getStateFilePath(rootPath, profileName);
    const data: SelectionStateData = {
      version: 1,
      updatedAt: new Date().toISOString(),
      profile: profileName,
      files: selectionMap,
    };

    await fs.promises.writeFile(
      stateFile,
      JSON.stringify(data, null, 2),
      "utf8",
    );
    return stateFile;
  }

  public async loadSelection(
    rootPath: string,
    profileName: string = "default",
  ): Promise<Record<string, boolean> | null> {
    const stateFile = this.getStateFilePath(rootPath, profileName);
    if (!fs.existsSync(stateFile)) {
      return null;
    }

    try {
      const raw = await fs.promises.readFile(stateFile, "utf8");
      const data = JSON.parse(raw) as SelectionStateData;
      return data.files || null;
    } catch {
      return null;
    }
  }

  public async isFileIncluded(
    rootPath: string,
    relPath: string,
    defaultIncluded: boolean = true,
    profileName: string = "default",
  ): Promise<boolean> {
    const existing = await this.loadSelection(rootPath, profileName);
    if (!existing || existing[relPath] === undefined) {
      return defaultIncluded;
    }
    return existing[relPath];
  }

  public async toggleFile(
    rootPath: string,
    relPath: string,
    defaultIncluded: boolean = true,
    profileName: string = "default",
  ): Promise<{
    included: boolean;
    files: Record<string, boolean>;
    stateFile: string;
  }> {
    const existing = (await this.loadSelection(rootPath, profileName)) || {};
    const current =
      existing[relPath] !== undefined ? existing[relPath] : defaultIncluded;
    const next = !current;
    const updated: Record<string, boolean> = {
      ...existing,
      [relPath]: next,
    };
    const stateFile = await this.saveSelection(rootPath, updated, profileName);
    return { included: next, files: updated, stateFile };
  }

  public async toggleBatch(
    rootPath: string,
    items: ToggleBatchItem[],
    profileName: string = "default",
  ): Promise<{
    included: boolean;
    files: Record<string, boolean>;
    stateFile: string;
    count: number;
  }> {
    const existing = (await this.loadSelection(rootPath, profileName)) || {};
    if (items.length === 0) {
      return {
        included: false,
        files: existing,
        stateFile: this.getStateFilePath(rootPath, profileName),
        count: 0,
      };
    }

    const allCurrentlyIncluded = items.every((item) => {
      const cur =
        existing[item.relPath] !== undefined
          ? existing[item.relPath]
          : item.defaultIncluded;
      return cur === true;
    });
    const next = !allCurrentlyIncluded;
    const updated: Record<string, boolean> = { ...existing };
    for (const item of items) {
      updated[item.relPath] = next;
    }
    const stateFile = await this.saveSelection(rootPath, updated, profileName);
    return {
      included: next,
      files: updated,
      stateFile,
      count: items.length,
    };
  }

  public async listProfiles(rootPath: string): Promise<string[]> {
    const stateDir = path.join(rootPath, this.STATE_DIR);
    if (!fs.existsSync(stateDir)) {
      return ["default"];
    }

    const files = await fs.promises.readdir(stateDir);
    const profiles: string[] = ["default"];

    for (const file of files) {
      if (file === this.DEFAULT_STATE_FILE) continue;
      const match = file.match(/^selection-state-(.+)\.json$/);
      if (match && match[1]) {
        profiles.push(match[1]);
      }
    }

    return Array.from(new Set(profiles));
  }
}
