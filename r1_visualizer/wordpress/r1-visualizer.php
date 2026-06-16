<?php
/**
 * Plugin Name: STB R-1 Visualizer
 * Description: Embeds the STB Form R-1 visualizer via the [r1_viewer] shortcode.
 * Version: 0.1.0
 *
 * Build the front-end first (`npm run build` in r1_visualizer/) and copy the
 * emitted dist/ files into this plugin's assets/ folder:
 *     dist/r1-viewer.js  -> assets/r1-viewer.js
 *     dist/r1-viewer.css -> assets/r1-viewer.css
 * Then upload the canonical JSON + manifest.json to wp-content/uploads/r1-data/
 * (or a CDN) and set R1_DATA_BASE below to match.
 */

if (!defined('ABSPATH')) exit;

// Where the JSON files + manifest.json are served from (absolute URL or path).
define('R1_DATA_BASE', content_url('uploads/r1-data'));

function r1_visualizer_assets() {
    $dir = plugin_dir_url(__FILE__) . 'assets/';
    // Built as an ES module; load deferred.
    wp_enqueue_script('r1-viewer', $dir . 'r1-viewer.js', array(), '0.1.0', true);
    wp_enqueue_style('r1-viewer', $dir . 'r1-viewer.css', array(), '0.1.0');
}

// Mark the script as a module so the ESM bundle loads correctly.
add_filter('script_loader_tag', function ($tag, $handle) {
    if ($handle === 'r1-viewer') {
        return str_replace('<script ', '<script type="module" ', $tag);
    }
    return $tag;
}, 10, 2);

/**
 * [r1_viewer carrier="BNSF" year="2025"]
 * Emits a mount point; the bundle auto-mounts any [data-r1-viewer] node.
 */
function r1_visualizer_shortcode($atts) {
    $a = shortcode_atts(array(
        'carrier' => '',
        'year'    => '',
        'base'    => R1_DATA_BASE,
    ), $atts);

    r1_visualizer_assets();

    return sprintf(
        '<div data-r1-viewer data-base="%s" data-carrier="%s" data-year="%s"></div>',
        esc_attr($a['base']),
        esc_attr($a['carrier']),
        esc_attr($a['year'])
    );
}
add_shortcode('r1_viewer', 'r1_visualizer_shortcode');
