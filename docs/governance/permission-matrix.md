# Permission Matrix (Current)

## Roles
- `admin`
- `manager`
- `user`

## Domain permissions
- `can_manage_leads`: admin, manager, user
- `can_manage_finance`: admin, manager
- `can_manage_projects`: admin, manager
- `can_manage_team`: admin, manager

## Execution permissions
- `can_update_stage`: admin, manager, user
- `can_toggle_checklist`: admin, manager, user
- `can_add_diary`: admin, manager, user
- `can_recalculate_risk`: admin, manager

## Change policy
Any permission change must include:
1. code update in auth layer,
2. test coverage,
3. ADR update if cross-domain impact exists.
