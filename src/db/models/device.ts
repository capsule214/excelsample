import { DataTypes } from "sequelize"
import { sequelize } from "../connection"

export const Device = sequelize.define("Device", {
  device_id:              { type: DataTypes.TEXT, primaryKey: true },
  model_id:               { type: DataTypes.TEXT, allowNull: false },
  serial_number:          { type: DataTypes.TEXT, allowNull: false },
  required_delivery_date: { type: DataTypes.TEXT },
}, { tableName: "devices", timestamps: false })
