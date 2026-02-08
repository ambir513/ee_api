import { createClient } from "redis";
import { log } from "../utils/logger.js";

/**
 * Create and export a Redis client instance.
 * The Redis URL is obtained from the environment variable REDIS_URL.
 * @type {import("redis").RedisClientType}
 **/

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

/**
 * Connect to the Redis server and handle connection errors.
 * Exits the process if a connection error occurs.
 * @returns {Promise<void>}
 **/

async function connectRedis() {
  try {
    redisClient.on("error", (err) => {
      log("Redis Client Error", "error");
    });

    if (!redisClient.isOpen) {
      await redisClient.connect();
    }

    log("Redis Client Connected", "success");
  } catch (error) {
    log(`Failed to connect to Redis`, "error");
  }
}

export default redisClient;
export { connectRedis };
