# The owner opens naima ui on a project with recorded metrics and finds the window usable: metric picker, commit range, chart and table

In a project with recorded metrics (`naima metrics backfill` if none), run `naima ui`. A window titled Naima opens on the metrics tab. Untick a metric, pick a later 'from' commit, press Show: the chart and the table show only the metrics ticked, over that range. Close the window: the command returns. Judge whether it is usable as a first, functional dashboard view (design is a later item).
