/*
 * Data Manager for NYD Bot
 * Handles persistent storage of bot data using JSON files
 */

const fs = require("fs").promises;
const path = require("path");

class DataManager {
  constructor() {
    this.dataDir = path.join(__dirname, "..", "data");
    this.dataFile = path.join(this.dataDir, "bot-data.json");
    this.defaultData = {
      blockRules: {},
      globalBlockRules: {},
      allowLists: {},
      watchmanChannels: [],
    };
  }

  // Ensure data directory exists
  async ensureDataDir() {
    try {
      await fs.access(this.dataDir);
    } catch (error) {
      await fs.mkdir(this.dataDir, { recursive: true });
      console.log("📁 Created data directory");
    }
  }

  // Load data from file
  async loadData() {
    try {
      await this.ensureDataDir();
      const data = await fs.readFile(this.dataFile, "utf8");
      const parsedData = JSON.parse(data);

      // Convert arrays back to Maps and Sets
      const convertedData = {
        blockRules: new Map(Object.entries(parsedData.blockRules || {}).map(([k, v]) => [k, new Set(v)])),
        globalBlockRules: new Map(Object.entries(parsedData.globalBlockRules || {}).map(([k, v]) => [k, new Set(v)])),
        allowLists: new Map(
          Object.entries(parsedData.allowLists || {}).map(([k, v]) => [
            k,
            {
              users: new Set(v.users || []),
              roles: new Set(v.roles || []),
            },
          ])
        ),
        watchmanChannels: new Set(parsedData.watchmanChannels || []),
      };

      console.log("📂 Loaded bot data from file");
      return convertedData;
    } catch (error) {
      if (error.code === "ENOENT") {
        console.log("📂 No existing data file found, starting with empty data");
        return {
          blockRules: new Map(),
          globalBlockRules: new Map(),
          allowLists: new Map(),
          watchmanChannels: new Set(),
        };
      }
      console.error("❌ Error loading data:", error.message);
      console.log("🔄 Starting with default data");
      return {
        blockRules: new Map(),
        globalBlockRules: new Map(),
        allowLists: new Map(),
        watchmanChannels: new Set(),
      };
    }
  }

  // Save data to file
  async saveData(data) {
    try {
      await this.ensureDataDir();

      // Convert Maps and Sets to JSON-serializable format
      const serializableData = {
        blockRules: Object.fromEntries(Array.from(data.blockRules.entries()).map(([k, v]) => [k, Array.from(v)])),
        globalBlockRules: Object.fromEntries(Array.from(data.globalBlockRules.entries()).map(([k, v]) => [k, Array.from(v)])),
        allowLists: Object.fromEntries(
          Array.from(data.allowLists.entries()).map(([k, v]) => [
            k,
            {
              users: Array.from(v.users),
              roles: Array.from(v.roles),
            },
          ])
        ),
        watchmanChannels: Array.from(data.watchmanChannels),
      };

      await fs.writeFile(this.dataFile, JSON.stringify(serializableData, null, 2));
      console.log("💾 Bot data saved successfully");
    } catch (error) {
      console.error("❌ Error saving data:", error.message);
      throw error;
    }
  }

  // Create backup of current data
  async createBackup(data) {
    try {
      await this.ensureDataDir();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupFile = path.join(this.dataDir, `backup-${timestamp}.json`);

      const serializableData = {
        blockRules: Object.fromEntries(Array.from(data.blockRules.entries()).map(([k, v]) => [k, Array.from(v)])),
        globalBlockRules: Object.fromEntries(Array.from(data.globalBlockRules.entries()).map(([k, v]) => [k, Array.from(v)])),
        allowLists: Object.fromEntries(
          Array.from(data.allowLists.entries()).map(([k, v]) => [
            k,
            {
              users: Array.from(v.users),
              roles: Array.from(v.roles),
            },
          ])
        ),
        watchmanChannels: Array.from(data.watchmanChannels),
      };

      await fs.writeFile(backupFile, JSON.stringify(serializableData, null, 2));
      console.log(`💾 Backup created: ${backupFile}`);
    } catch (error) {
      console.error("❌ Error creating backup:", error.message);
    }
  }

  // Get data statistics
  getDataStats(data) {
    return {
      channelsWithRules: data.blockRules.size,
      serversWithGlobalRules: data.globalBlockRules.size,
      serversWithAllowlists: data.allowLists.size,
      watchmanChannels: data.watchmanChannels.size,
      totalBlockRules: Array.from(data.blockRules.values()).reduce((sum, set) => sum + set.size, 0),
      totalGlobalRules: Array.from(data.globalBlockRules.values()).reduce((sum, set) => sum + set.size, 0),
    };
  }
}

module.exports = DataManager;
