"use strict";
const { src, dest, task, watch, series, parallel } = require("gulp");
const del = require("del");
const sass = require("gulp-sass");
const sourcemaps = require("gulp-sourcemaps");
const babel = require("gulp-babel");
const cleanCSS = require("gulp-clean-css");
const rename = require("gulp-rename");
const merge = require("merge-stream");
const htmlreplace = require("gulp-html-replace");
const autoprefixer = require("gulp-autoprefixer");
const browserSync = require("browser-sync").create();

const imagemin = require("gulp-imagemin");

task("clean", () => del(["./dist", "./assets/css/app.css"]));

task("vendor:js", () =>
    src([
        "./node_modules/bootstrap/dist/js/*",
        "./node_modules/jquery/dist/*",
        "./node_modules/popper.js/dist/umd/popper.*",
    ]).pipe(dest("./assets/js/vendor"))
);

task("vendor:fonts", () =>
    src([
        "./node_modules/@fortawesome/fontawesome-free/**/*",
        "!./node_modules/@fortawesome/fontawesome-free/{less,less/*}",
        "!./node_modules/@fortawesome/fontawesome-free/{scss,scss/*}",
        "!./node_modules/@fortawesome/fontawesome-free/.*",
        "!./node_modules/@fortawesome/fontawesome-free/*.{txt,json,md}",
    ]).pipe(dest("./assets/fonts/font-awesome"))
);
task("vendor", parallel("vendor:fonts", "vendor:js"));

task("vendor:build", () => {
    const jsStream = src([
        "./assets/js/vendor/bootstrap.bundle.min.js",
        "./assets/js/vendor/jquery.slim.min.js",
        "./assets/js/vendor/popper.min.js",
    ]).pipe(dest("./dist/js/vendor"));
    const fontStream = src(["./assets/fonts/font-awesome/**/*.*"]).pipe(
        dest("./dist/fonts/font-awesome")
    );
    return merge(jsStream, fontStream);
});

task("bootstrap:scss", () =>
    src(["./node_modules/bootstrap/scss/**/*"]).pipe(dest("./assets/scss/bootstrap"))
);

task(
    "scss",
    series("bootstrap:scss", function compileScss() {
        return src(["./assets/scss/*.scss"])
            .pipe(sourcemaps.init())
            .pipe(
                sass
                    .sync({
                        outputStyle: "expanded",
                    })
                    .on("error", sass.logError)
            )
            .pipe(autoprefixer())
            .pipe(sourcemaps.write())
            .pipe(dest("./assets/css"));
    })
);

task(
    "css:minify",
    series("scss", function cssMinify() {
        return src("./assets/css/app.css")
            .pipe(cleanCSS())
            .pipe(
                rename({
                    suffix: ".min",
                })
            )
            .pipe(dest("./dist/css"))
            .pipe(browserSync.stream());
    })
);

task("js:minify", () =>
    src(["./assets/js/app.js"])
        .pipe(babel({ presets: ["minify"] }))
        .pipe(
            rename({
                suffix: ".min",
            })
        )
        .pipe(dest("./dist/js"))
        .pipe(browserSync.stream())
);

task("replaceHtmlBlock", () =>
    src(["*.html"])
        .pipe(
            htmlreplace({
                js: "assets/js/app.min.js",
                css: "assets/css/app.min.css",
            })
        )
        .pipe(dest("dist/"))
);

task("watch", function browserDev(done) {
    browserSync.init({
        server: {
            baseDir: "./",
        },
    });
    watch(
        ["assets/scss/*.scss", "assets/scss/**/*.scss", "!assets/scss/bootstrap/**"],
        series("css:minify", function cssBrowserReload(done) {
            browserSync.reload();
            done(); //Async callback for completion.
        })
    );
    watch(
        "assets/js/app.js",
        series("js:minify", function jsBrowserReload(done) {
            browserSync.reload();
            done();
        })
    );
    watch(["*.html"]).on("change", browserSync.reload);
    done();
});

task("image:build", () =>
    src("./assets/img/*")
        .pipe(
            imagemin([
                imagemin.mozjpeg({ quality: 75, progressive: true }),
                imagemin.optipng({ optimizationLevel: 5 }),
                imagemin.svgo({
                    plugins: [{ removeViewBox: true }, { cleanupIDs: false }],
                }),
            ])
        )
        .pipe(dest("dist/img"))
);

task(
    "build",
    series(
        parallel("css:minify", "js:minify", "vendor", "image:build"),
        "vendor:build",
        function copyAssets() {
            return src(["*.html"], {
                base: "./",
            }).pipe(dest("dist"));
        }
    )
);

// Default task
task("default", series("clean", "build", "replaceHtmlBlock"));
