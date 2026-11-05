import { Snowflake } from '@skorotkiewicz/snowflake-id';

const snowflake = new Snowflake(42 * 10);

export const getSnowflakeId = async () => {
  return await snowflake.generate();
};
