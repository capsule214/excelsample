import { DataTypes } from "sequelize"
import { sequelize } from "../connection"

export const Task = sequelize.define("Task", {
  task_id:    { type: DataTypes.TEXT, primaryKey: true },
  task_name:  { type: DataTypes.TEXT, allowNull: false },
  color_bg:   { type: DataTypes.TEXT, allowNull: false },
  color_fg:   { type: DataTypes.TEXT, allowNull: false },
  sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: "tasks", timestamps: false })
