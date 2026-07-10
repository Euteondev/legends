import { Router, type IRouter } from "express";
import healthRouter from "./health";
import collaboratorsRouter from "./collaborators";
import usersRouter from "./users";
import missionsRouter from "./missions";
import adminRouter from "./admin";
import rankingsRouter from "./rankings";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(collaboratorsRouter);
router.use(usersRouter);
router.use(missionsRouter);
router.use(adminRouter);
router.use(rankingsRouter);
router.use(statsRouter);

export default router;
