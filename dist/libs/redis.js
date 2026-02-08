import { Redis } from "@upstash/redis";
import { log } from "../utils/logger.js";
const redisClient = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
log("Upstash Redis client initialized", "success");
export default redisClient;
