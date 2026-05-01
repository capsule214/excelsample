import { DataTypes } from "sequelize"
import { sequelize } from "../connection"

export const LocationSchedule = sequelize.define("LocationSchedule", {
  id:          { type: DataTypes.TEXT, primaryKey: true },
  location_id: { type: DataTypes.TEXT, allowNull: false },
  device_id:   { type: DataTypes.TEXT, allowNull: false },
  start_date:  { type: DataTypes.TEXT, allowNull: false },
  end_date:    { type: DataTypes.TEXT, allowNull: false },
}, { tableName: "location_schedules", timestamps: false })
