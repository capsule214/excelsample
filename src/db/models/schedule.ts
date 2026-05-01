import { DataTypes } from "sequelize"
import { sequelize } from "../connection"

export const Schedule = sequelize.define("Schedule", {
  id:          { type: DataTypes.TEXT, primaryKey: true },
  device_id:   { type: DataTypes.TEXT, allowNull: false },
  task_id:     { type: DataTypes.TEXT, allowNull: false },
  assignee_id: { type: DataTypes.TEXT, allowNull: false },
  location_id: { type: DataTypes.TEXT, allowNull: true },
  start_date:  { type: DataTypes.TEXT, allowNull: false },
  end_date:    { type: DataTypes.TEXT, allowNull: false },
}, { tableName: "schedules", timestamps: false })
