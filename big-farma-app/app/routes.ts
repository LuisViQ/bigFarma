import {
  type RouteConfig,
  index,
  route,
  layout,
} from "@react-router/dev/routes";

export default [
  index("routes/login.tsx"),
  layout("routes/private-layout.tsx", [
    route("home", "routes/home.tsx"),
    route("history", "routes/history.tsx"),
  ]),
] satisfies RouteConfig;
