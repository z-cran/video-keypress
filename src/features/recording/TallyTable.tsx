import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { formatDuration } from "../../lib/time.ts";
import { useBehaviorsStore } from "../behaviors/behaviorsStore.ts";
import { useTally } from "./useTally.ts";

function percent(value: number | null): string {
  return value === null ? "--" : `${value.toFixed(1)}%`;
}

export default function TallyTable() {
  const behaviors = useBehaviorsStore((s) => s.behaviors);
  const tally = useTally();

  return (
    <Paper component="section" aria-labelledby="tally-title" sx={{ p: 2 }}>
      <Typography
        id="tally-title"
        variant="subtitle1"
        component="h2"
        sx={{ fontWeight: 700, mb: 1 }}
      >
        Tally
      </Typography>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" aria-labelledby="tally-title">
          <TableHead>
            <TableRow>
              <TableCell>Behavior</TableCell>
              <TableCell align="right">Count</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="right">Mean</TableCell>
              <TableCell align="right">Of video</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {behaviors.map((b) => {
              const t = tally.get(b.id);
              return (
                <TableRow key={b.id} data-testid={`tally-${b.name}`}>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          bgcolor: b.color,
                          flexShrink: 0
                        }}
                      />
                      {b.name}
                    </Box>
                  </TableCell>
                  <TableCell align="right">{t?.count ?? 0}</TableCell>
                  <TableCell align="right">
                    {formatDuration(t?.total ?? 0)}
                  </TableCell>
                  <TableCell align="right">
                    {t?.mean == null ? "--" : formatDuration(t.mean)}
                  </TableCell>
                  <TableCell align="right">
                    {percent(t?.percentOfVideo ?? null)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );
}
