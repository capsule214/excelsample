import { DataTypes } from "sequelize"
import { sequelize } from "../connection"

export const Assignee = sequelize.define("Assignee", {
  assignee_id: { type: DataTypes.TEXT, primaryKey: true },
  name:        { type: DataTypes.TEXT, allowNull: false },
}, { tableName: "assignees", timestamps: false })
