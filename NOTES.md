/*
Overpass query to get transit nodes with three or more routes
*/
node
  [highway="bus"]
  ({{bbox}});
out;