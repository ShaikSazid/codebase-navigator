import type { DataModelAnalyzer } from "./data-model-analyzer.js";

import { mongooseAnalyzer } from "./analyzers/javascript/mongoose-analyzer.js";
import { sequelizeAnalyzer } from "./analyzers/javascript/sequelize-analyzer.js";
import { typeormAnalyzer } from "./analyzers/typescript/typeorm-analyzer.js";
import { prismaAnalyzer } from "./analyzers/typescript/prisma-analyzer.js";
import { sqlalchemyAnalyzer } from "./analyzers/python/sqlalchemy-analyzer.js";
import { djangoAnalyzer } from "./analyzers/python/django-analyzer.js";
import { pydanticAnalyzer } from "./analyzers/python/pydantic-analyzer.js";
import { jpaAnalyzer } from "./analyzers/java/jpa-analyzer.js";
import { gormAnalyzer } from "./analyzers/go/gorm-analyzer.js";
import { dieselAnalyzer } from "./analyzers/rust/diesel-analyzer.js";
import { seaOrmAnalyzer } from "./analyzers/rust/seaorm-analyzer.js";
import { efCoreAnalyzer } from "./analyzers/csharp/efcore-analyzer.js";
import { activeRecordAnalyzer } from "./analyzers/ruby/activerecord-analyzer.js";

const ANALYZERS: DataModelAnalyzer[] = [
  prismaAnalyzer,
  mongooseAnalyzer,
  sequelizeAnalyzer,
  typeormAnalyzer,
  sqlalchemyAnalyzer,
  djangoAnalyzer,
  pydanticAnalyzer,
  jpaAnalyzer,
  gormAnalyzer,
  dieselAnalyzer,
  seaOrmAnalyzer,
  efCoreAnalyzer,
  activeRecordAnalyzer,
];

export function getDataModelAnalyzer(
  language: string,
  imports: Parameters<DataModelAnalyzer["canAnalyze"]>[1],
  source = "",
): DataModelAnalyzer | null {
  return (
    ANALYZERS.find((analyzer) =>
      analyzer.canAnalyze(language, imports, source),
    ) ?? null
  );
}
