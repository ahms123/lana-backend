const createProtectedRouter = require("./createProtectedRouter");
const { listActions } = require("../controllers/earn");

const router = createProtectedRouter();

router.get("/actions", listActions);

module.exports = router;
