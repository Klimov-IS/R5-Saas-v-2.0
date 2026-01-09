-- Find stores with exact same names
SELECT name, COUNT(*) as count
FROM stores
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY count DESC, name;
