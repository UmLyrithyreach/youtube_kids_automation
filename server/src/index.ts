import { requeueOrphans } from "./db.ts"
import { startServer } from "./api.ts"

requeueOrphans()
startServer(Number(process.env.YK_PORT ?? 8787))