// Reviewed against forms/R1-7-31-2026.pdf (physical pages 10-11, 21-28,
// 31-44, 46-60, 62, 64, 66, 69, 71-76, 78-79, 82-85). Keys are explicit:
// schema declaration order is not evidence of printed column order.
// Apply only where a real letter ruler occurs; never to instruction prose.
const consecutive = (first, fields) => Object.fromEntries(fields.map((key,i) => [String.fromCharCode(first.charCodeAt(0)+i),key]))
const B = {
  '200': ['close_of_year','beginning_of_year'],
  '210': ['amount_for_current_year','preceding_year_amount','freight_related_revenue_expenses','passenger_revenue_expense'],
  '210A': ['amount_for_current_year','amount_for_preceding_year'],
  '220': ['retained_earnings_unappropriated','equity_in_undistrib_earnings_of'],
  '240': ['current_year','previous_year'], '245': ['amount'],
  '330': ['balance_at_beginning_of_year','expend_during_the_year_for_original_road','expend_during_the_year_for_purch_of','expend_for_additions_during_the_year','credits_for_prop_retired_during_the_year','net_changes_during_the_year','balance_at_close_of_year'],
  '332': ['owned_and_used.depreciation_base_beginning_of_year','owned_and_used.depreciation_base_close_of_year','owned_and_used.annual_composite_rate','leased_from_others.depreciation_base_beginning_of_year','leased_from_others.depreciation_base_close_of_year','leased_from_others.annual_composite_rate'],
  '335': ['balance_at_beginning_of_year','credits_to_reserve_during_the_year','other_credits','debits_to_reserve_during_the_year','other_debits','balance_at_close_of_year'],
  '342': ['balance_at_beginning_of_year','credits_to_reserve_during_the_year','other_credits','debits_to_reserve_during_the_year','other_debits','balance_at_close_of_year'],
  '352B': ['respondent','lessor_railroads','inactive','other_leased_properties'],
  '410': ['salaries_wages','material_tools_supplies_fuels_lubricants','purchased_services','general','total_freight_expense','passenger','total'],
  '412': ['depreciation','lease_rentals','amortization_adjustment_during_year'],
  '414': ['gross_amounts_receivable_per_diem_basis.private_line_cars_b','gross_amounts_receivable_per_diem_basis.mileage_c','gross_amounts_receivable_per_diem_basis.time_d','gross_amounts_payable_per_diem_basis.private_line_cars_e','gross_amounts_payable_per_diem_basis.mileage_f','gross_amounts_payable_per_diem_basis.time_g'],
  '415': ['expenses.repairs','expenses.depreciation_owned','expenses.depreciation_capitalized_lease','expenses.amortization_adjustment_net_during_year','expenses.lease_rentals','investment_base_as_of_12_31.owned','investment_base_as_of_12_31.capitalized_lease','accumulated_depreciation_as_of_12_31.owned','accumulated_depreciation_as_of_12_31.capitalized_lease'],
  '417': ['tofc_cofc_terminal','floating_equipment','coal_marine_terminal','ore_marine_terminal','other_marine_terminal','motor_vehicle_load_distribution','protective_services_refrigerator_car','other_special_services','total_columns'],
  '702': ['miles_of_road_operated_by_resp_owned','line_of_proprietary_companies','line_operated_under_lease','line_operated_under_contract_etc','line_operated_under_trackage_rights','total_mileage_operated','line_owned_not_operated_by_respondent','new_line_constructed_during_year'],
  '720': ['mileage_of_tracks_at_end_of_period','average_annual_traffic_density_in','average_running_speed_limit','track_miles_under_slow_orders_at_end_of'],
  '750': ['diesel_oil'], '755': ['freight_train','passenger_train'],
}
const A = {
  '310': ['account_no','class_no','kind_of_industry','issuer_name_and_lien_reference','extent_of_control','opening_balance','additions','deductions','closing_balance','disposed_profit_loss','adjustments_account_721_5','dividends_or_interest_credited_to_income'],
  '310A': [['name_of_issuing_company_and_description','enter_in_column_the_amortization_for_the'],'balance_at_beginning_of_year','adjust_for_invest_equity_method','equity_in_un_distributed_earnings_during','amortization_during_year',['adjustment_for_investments_disposed_or_written_down','adjust_for_invest_dis_posed_of_or'],'balance_at_close_of_year'],
  '352A': ['in_column_show_the_amount_of_depr_and','name_of_company','miles_of_road_used','investments_in_property','depr_amortization_of_defense_projects'],
  '501': [['names_of_all_parties_principally_liable','if_the_resp_was_under_obligation_as'],'description','amount_of_contingent_liability','sole_or_joint_contingent_liability'],
  '510': ['account_no','title','source','balance_close_of_year'],
  '512': ['name_of_co_or_related_party_with_percent','nature_of_relationship','description_of_transactions','dollar_amounts_of_transactions','amount_due_from_or_to_related_parties'],
}
const EQUIPMENT_FIRST = ['units_in_service_of_resp_at_begin_of','new_units_purchased_or_built','new_units_leased_from_others','rebuilt_units_acquired_and_rebuilt_units','all_other_units_incl_reclass_and_second','units_retired_from_service_of_resp','owned_and_used','leased_from_others','total_in_service_of_respondent_col','agg_cap_of_units_reported_in_col','leased_to_others']
// Freight-car panels in the latest blank form restart at (b), while canonical
// historical keys retain the earlier edition's (m)..(y) suffixes.
const EQUIPMENT_FREIGHT = ['respondent_begin_year_time_mileage_cars','all_others','units_installed_new_units_purch_or_built','new_or_rebuilt_units_leased_from_others','rebuilt_units_acquired_and_rebuilt_col_q','all_other_units_incl_reclass_and_s_col_r','units_retired_from_service_of_resp_col_s','owned_and_used_col_t','leased_from_others_col_u','total_in_service_of_resp_time_mileage','all_others_col_w','agg_cap_of_units_reported_in_col_col_x','leased_to_others_col_y']

export function contractForPanel(page, scheduleId) {
  const id = String(scheduleId || '').replace(/^PTC_/, '')
  if (id === '710') {
    // Shared full-sheet context survives splitting the two facing panels.
    const letters = page.contractLetters || page.rows.flatMap((r) => r.cells.map((c) => String(c.t || '').match(/^\(([a-z])\)$/)?.[1]))
    if (letters.includes('y')) return consecutive('m', EQUIPMENT_FREIGHT)
    return consecutive('b', letters.includes('n') ? EQUIPMENT_FREIGHT : EQUIPMENT_FIRST)
  }
  if (B[id]) return consecutive('b', B[id])
  if (A[id]) return consecutive('a', A[id])
  return null
}
