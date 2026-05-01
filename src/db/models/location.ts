import { DataTypes } from "sequelize"
import { sequelize } from "../connection"

export const Location = sequelize.define("Location", {
  location_id: { type: DataTypes.TEXT, primaryKey: true },
  name:        { type: DataTypes.TEXT, allowNull: false },
  sort_order:  { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: "locations", timestamps: false })
