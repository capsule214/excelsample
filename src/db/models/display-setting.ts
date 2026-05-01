import { DataTypes } from "sequelize"
import { sequelize } from "../connection"

export const DisplaySetting = sequelize.define("DisplaySetting", {
  setting_key: { type: DataTypes.TEXT, primaryKey: true },
  value:       { type: DataTypes.TEXT, allowNull: false, defaultValue: "[]" },
}, { tableName: "display_settings", timestamps: false })
