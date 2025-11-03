import React from "react";
import { Box, Button, Typography } from "@mui/material";
import Notifications from "./Notifications"; // Import Notifications component

export default function TopBar({ user, onLogout }: { user: { username: string }; onLogout: () => void }) {
  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 56,
        background: "white",
        boxShadow: "0 2px 8px #e3e8ee",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        px: 3,
        zIndex: 1300,
      }}
    >
      {/* Username */}
      <Typography variant="body1" sx={{ fontWeight: 600}}>
        {user?.username}
      </Typography>

      

      {/* Logout button */}
      <Button
        color="error"
        variant="text"
        size="small"
        onClick={onLogout}
        sx={{ fontWeight: 600, textTransform: "none" ,mr: 2}}
      >
        Logout
      </Button>
      {/* Notifications with margin right */}
      <Box sx={{ml:4}} >
        <Notifications />
      </Box>
    </Box>
  );
}
